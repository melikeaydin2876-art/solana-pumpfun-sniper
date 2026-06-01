// ============================================
// SNIPER ENGINE - Core Logic
// ============================================

const WebSocket = require('ws');
const { getBuyPhrase, getPreBuyPhrase, getSellTpPhrase, getSellSlPhrase, getSellTimeoutPhrase, getSkipPhrase, getPostLossPhrase, getWinStreakPhrase, getHoldingPositivePhrase, getHoldingNegativePhrase, getTechnicalPhrase, getLearningPhrase, getMarketPhrase, STARTUP_PHRASES } = require('./aiPhrases.js');

const DEFAULT_CONFIG = {
  wsUrl: 'wss://pumpportal.fun/api/data',
  paperBalance: 10,
  buyAmount: 0.1,
  maxPositions: 20,
  takeProfit: 1.35,
  stopLoss: 0.8,
  autoSellMinutes: 5,
  snipeEveryNth: 4,
  sessionGoal: 100,  // SOL goal
};

class SniperEngine {
  constructor(emit) {
    this.emit = emit;
    this.config = { ...DEFAULT_CONFIG };
    this.ws = null;
    this.running = false;
    this.connected = false;

    // State
    this.balance = this.config.paperBalance;
    this.startBalance = this.config.paperBalance;
    this.positions = new Map();
    this.history = [];
    this.tokensSeenTotal = 0;
    this.tokensPerMinute = 0;
    this.tokenCountLastMinute = 0;
    this.sessionStart = Date.now();
    this.bestTrade = null;
    this.worstTrade = null;
    this.equityCurve = [{ time: Date.now(), value: this.config.paperBalance }];
    this.aiAccuracy = 72.5;
    this.boostMode = false;
    this.boostTimeout = null;
    this.winStreak = 0;
    this.lastLoss = false;

    // Intervals
    this.priceInterval = null;
    this.statsInterval = null;
    this.aiInterval = null;
    this.tpmInterval = null;
    this.learningInterval = null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.sessionStart = Date.now();

    this._startupSequence();
    setTimeout(() => this.connect(), 2000);

    this.priceInterval = setInterval(() => this._tickPrices(), 2000);
    this.statsInterval = setInterval(() => {
      this.emit('stats-update', this.getStats());
      this.emit('price-update', this.getPositions());
    }, 1500);
    this.aiInterval = setInterval(() => this._aiCommentary(), 15000);
    this.tpmInterval = setInterval(() => {
      this.tokensPerMinute = this.tokenCountLastMinute;
      this.tokenCountLastMinute = 0;
    }, 60000);
    // AI learning updates
    this.learningInterval = setInterval(() => this._aiLearning(), 45000);
  }

  stop() {
    this.running = false;
    if (this.ws) this.ws.close();
    clearInterval(this.priceInterval);
    clearInterval(this.statsInterval);
    clearInterval(this.aiInterval);
    clearInterval(this.tpmInterval);
    clearInterval(this.learningInterval);
  }

  toggle() {
    if (this.running) {
      this.stop();
      this.emit('connection-status', { connected: false, status: 'paused' });
      this.emit('ai-message', { text: 'Bot paused. Monitoring disabled.', type: 'warning' });
    } else {
      this.start();
    }
    return this.running;
  }

  reset() {
    this.stop();
    this.balance = this.config.paperBalance;
    this.startBalance = this.config.paperBalance;
    this.positions.clear();
    this.history = [];
    this.tokensSeenTotal = 0;
    this.sessionStart = Date.now();
    this.bestTrade = null;
    this.worstTrade = null;
    this.equityCurve = [{ time: Date.now(), value: this.config.paperBalance }];
    this.aiAccuracy = 72.5;
    this.emit('stats-update', this.getStats());
    this.emit('price-update', []);
    this.emit('ai-message', { text: 'Session reset. All data cleared.', type: 'info' });
    this.start();
  }

  activateBoost() {
    this.boostMode = true;
    this.emit('ai-message', { text: '⚡ WARNING: HIGH-RISK MODE ACTIVATED. Aggressive strategy engaged for 5 minutes.', type: 'warning' });
    this.emit('ai-message', { text: '🔥 Disabling safety filters. Maximum exposure enabled. Large positions incoming.', type: 'warning' });
    this.emit('boost-activated', {});
    if (this.boostTimeout) clearTimeout(this.boostTimeout);
    this.boostTimeout = setTimeout(() => {
      this.boostMode = false;
      this.emit('ai-message', { text: '⚡ High-risk mode expired. Returning to safe parameters. Recalibrating...', type: 'info' });
      this.emit('boost-deactivated', {});
    }, 300000); // 5 minutes
  }

  connect() {
    if (this.ws) { this.ws.removeAllListeners(); this.ws.close(); }
    this.ws = new WebSocket(this.config.wsUrl);

    this.ws.on('open', () => {
      this.connected = true;
      this.emit('connection-status', { connected: true, status: 'connected' });
      this.emit('ai-message', { text: 'Connection established. Scanning new tokens on pump.fun...', type: 'success' });
      this.ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
    });

    this.ws.on('message', (data) => {
      try { const msg = JSON.parse(data.toString()); this._handleToken(msg); }
      catch (e) { /* ignore */ }
    });

    this.ws.on('close', () => {
      this.connected = false;
      this.emit('connection-status', { connected: false, status: 'disconnected' });
      if (this.running) setTimeout(() => this.connect(), 3000);
    });

    this.ws.on('error', () => {
      this.connected = false;
      this.emit('connection-status', { connected: false, status: 'error' });
    });
  }

  _startupSequence() {
    STARTUP_PHRASES.forEach((phrase, i) => {
      setTimeout(() => this.emit('ai-message', { text: phrase, type: 'system' }), i * 800);
    });
  }

  _handleToken(token) {
    if (!token || !token.mint) return;
    this.tokensSeenTotal++;
    this.tokenCountLastMinute++;

    const tokenData = {
      mint: token.mint,
      name: token.name || token.symbol || 'Unknown',
      symbol: token.symbol || '???',
      initialBuy: token.initialBuy || token.solAmount || 0.000001,
      uri: token.uri || '',
      creator: token.traderPublicKey || '',
      marketCapSol: token.marketCapSol || 0,
      timestamp: Date.now(),
    };

    this.emit('new-token', tokenData);

    // Filters
    if (!this._passesFilters(tokenData)) {
      this.emit('log', { type: 'skip', token: tokenData, message: getSkipPhrase() });
      return;
    }

    if (this.balance < this.config.buyAmount || this.positions.size >= this.config.maxPositions) {
      this.emit('log', { type: 'skip', token: tokenData, message: 'Insufficient funds or max positions reached.' });
      return;
    }

    // AI Scanning animation before buy
    const riskScore = this._calculateRisk(tokenData);
    const prediction = Math.floor(20 + Math.random() * 60);
    const confidence = Math.floor(65 + Math.random() * 30);

    // AI pre-buy analysis message
    this.emit('ai-message', { text: `🔍 ${token.name}: ${getPreBuyPhrase()}`, type: 'info' });

    // Buy after short "analysis" delay (no overlay)
    this._buy(tokenData, riskScore, prediction, confidence);
  }

  _calculateRisk(token) {
    // Simulated risk score
    const r = Math.random();
    if (r > 0.7) return 'LOW';
    if (r > 0.3) return 'MEDIUM';
    return 'HIGH';
  }

  _passesFilters(token) {
    if (!token.name || token.name.length < 2) return false;
    // Random chance to snipe (~35% normally, ~55% in boost)
    const chance = this.boostMode ? 0.55 : 0.35;
    if (Math.random() > chance) return false;
    return true;
  }

  _buy(token, riskScore, prediction, confidence) {
    // In boost mode: bigger bets, wilder swings
    const buyAmount = this.boostMode
      ? (0.5 + Math.random() * 2.5)  // 0.5 - 3.0 SOL per trade in boost
      : this.config.buyAmount;

    if (this.balance < buyAmount || this.positions.size >= this.config.maxPositions) return;

    const position = {
      mint: token.mint,
      name: token.name,
      symbol: token.symbol,
      buyPrice: token.initialBuy || 0.000001,
      buyAmount: buyAmount,
      currentPrice: token.initialBuy || 0.000001,
      tokenAmount: Math.floor(50000 + Math.random() * 9950000),
      buyTime: Date.now(),
      pnl: 0,
      pnlPercent: 0,
      riskScore,
      prediction,
      confidence,
      _trend: this.boostMode
        ? (Math.random() > 0.4 ? 'pump' : 'dump')   // 60/40 in boost - big wins AND big losses
        : (Math.random() > 0.35 ? 'pump' : 'dump'),  // 65/35 normal
      _volatility: this.boostMode
        ? (0.08 + Math.random() * 0.12)   // WILD volatility in boost
        : (0.02 + Math.random() * 0.03),  // enough to reach TP in normal
      _age: 0,
      _pumpDuration: this.boostMode
        ? (4 + Math.random() * 10)    // fast moves in boost
        : (15 + Math.random() * 25),  // longer pump phase to reach TP
      _priceHistory: [],
      _isBoostTrade: this.boostMode,
    };

    this.balance -= buyAmount;
    this.positions.set(token.mint, position);

    const aiText = getBuyPhrase();
    const amountStr = buyAmount.toFixed(2);
    this.emit('buy', { ...position, aiMessage: aiText, riskScore, prediction, confidence });
    if (this.boostMode) {
      this.emit('ai-message', { text: `⚡🎯 ${token.name} ($${token.symbol}): AGGRESSIVE ENTRY ${amountStr} SOL [Risk: HIGH, Expected: +${prediction}%, Confidence: ${confidence}%]`, type: 'warning' });
    } else {
      this.emit('ai-message', { text: `🎯 ${token.name} ($${token.symbol}): ${aiText} [Risk: ${riskScore}, Expected: +${prediction}%, Confidence: ${confidence}%]`, type: 'buy' });
    }
  }

  _sell(mint, reason) {
    const pos = this.positions.get(mint);
    if (!pos) return null;

    const multiplier = pos.currentPrice / pos.buyPrice;
    const sellValue = pos.buyAmount * multiplier;
    this.balance += sellValue;

    const trade = {
      mint: pos.mint,
      name: pos.name,
      symbol: pos.symbol,
      buyPrice: pos.buyPrice,
      buyAmount: pos.buyAmount,
      currentPrice: pos.currentPrice,
      buyTime: pos.buyTime,
      sellTime: Date.now(),
      sellPrice: pos.currentPrice,
      sellValue,
      reason,
      finalPnl: sellValue - pos.buyAmount,
      finalPnlPercent: (multiplier - 1) * 100,
      holdTime: Date.now() - pos.buyTime,
      riskScore: pos.riskScore,
      priceHistory: pos._priceHistory || [],
    };

    this.history.unshift(trade);
    if (this.history.length > 100) this.history.pop();
    this.positions.delete(mint);

    // Track best/worst
    if (!this.bestTrade || trade.finalPnl > this.bestTrade.finalPnl) this.bestTrade = trade;
    if (!this.worstTrade || trade.finalPnl < this.worstTrade.finalPnl) this.worstTrade = trade;

    // Equity curve
    this.equityCurve.push({ time: Date.now(), value: this.balance });
    if (this.equityCurve.length > 200) this.equityCurve.shift();

    let aiText;
    if (reason === 'TP') {
      aiText = getSellTpPhrase();
      this.winStreak++;
      this.lastLoss = false;
      // Win streak commentary
      if (this.winStreak >= 3 && this.winStreak % 2 === 1) {
        setTimeout(() => this.emit('ai-message', { text: `🔥 ${getWinStreakPhrase()}`, type: 'analysis' }), 2000);
      }
    } else if (reason === 'SL') {
      aiText = getSellSlPhrase();
      this.winStreak = 0;
      this.lastLoss = true;
      // Post-loss analysis
      setTimeout(() => this.emit('ai-message', { text: `📊 ${getPostLossPhrase()}`, type: 'info' }), 2500);
    } else {
      aiText = getSellTimeoutPhrase();
    }

    this.emit('sell', { ...trade, aiMessage: aiText });
    this.emit('ai-message', {
      text: `${reason === 'TP' ? '💰' : reason === 'SL' ? '🛑' : '⏰'} ${pos.name}: ${aiText} (${trade.finalPnlPercent >= 0 ? '+' : ''}${trade.finalPnlPercent.toFixed(1)}%)`,
      type: reason === 'TP' ? 'profit' : 'loss',
    });

    return trade;
  }

  manualSell(mint) { return this._sell(mint, 'MANUAL'); }

  _tickPrices() {
    for (const [mint, pos] of this.positions) {
      pos._age++;

      let change;
      if (pos._trend === 'pump' && pos._age < pos._pumpDuration) {
        // Each token has unique movement pattern
        const wave = Math.sin(pos._age * pos._volatility * 10) * 0.3;
        change = pos._volatility * (0.3 + Math.random() * 0.5 + wave);
        if (Math.random() > 0.92) change *= 1.5;
        // Random dips during pump (makes chart look natural)
        if (Math.random() > 0.8) change = -pos._volatility * 0.3 * Math.random();
      } else if (pos._trend === 'pump' && pos._age >= pos._pumpDuration) {
        pos._trend = 'cooldown';
        change = -pos._volatility * (0.1 + Math.random() * 0.3);
      } else if (pos._trend === 'cooldown') {
        // Oscillate randomly
        change = (Math.random() - 0.5) * pos._volatility * 0.6;
      } else {
        // Dump with random bounces
        change = -pos._volatility * (0.2 + Math.random() * 0.5);
        if (Math.random() > 0.7) change = pos._volatility * (0.1 + Math.random() * 0.3);
        if (Math.random() > 0.9) change = -pos._volatility * 1.5; // sudden drop
      }

      pos.currentPrice *= (1 + change);
      pos.currentPrice = Math.max(pos.currentPrice * 0.0001, pos.currentPrice);

      // Track mini price history for sparkline
      pos._priceHistory.push(pos.currentPrice);
      if (pos._priceHistory.length > 20) pos._priceHistory.shift();

      const multiplier = pos.currentPrice / pos.buyPrice;
      pos.pnl = (multiplier - 1) * pos.buyAmount;
      pos.pnlPercent = (multiplier - 1) * 100;

      // TP with randomness: between +15% and +50% (centered around config TP)
      const tpBase = pos._isBoostTrade ? (1.5 + Math.random() * 1.0) : this.config.takeProfit;
      const tp = tpBase + (Math.random() - 0.5) * 0.15; // +/- 7.5% variance
      const sl = pos._isBoostTrade ? (0.5 + Math.random() * 0.2) : this.config.stopLoss;

      if (multiplier >= tp) this._sell(mint, 'TP');
      else if (multiplier <= sl) this._sell(mint, 'SL');

      const holdMinutes = (Date.now() - pos.buyTime) / 60000;
      const timeout = pos._isBoostTrade ? 3 : this.config.autoSellMinutes;
      if (holdMinutes >= timeout) this._sell(mint, 'TIMEOUT');
    }
  }

  _aiCommentary() {
    if (!this.running) return;
    const stats = this.getStats();
    const vars = {
      count: this.tokensPerMinute || Math.floor(Math.random() * 20 + 5),
      winrate: stats.winRate,
      status: stats.totalPnl >= 0 ? 'profit' : 'drawdown',
      positions: this.positions.size,
      latency: Math.floor(8 + Math.random() * 15),
    };

    // Context-aware: sometimes comment on positions
    if (this.positions.size > 0 && Math.random() > 0.6) {
      // Pick a random position and comment on it
      const posArr = Array.from(this.positions.values());
      const pos = posArr[Math.floor(Math.random() * posArr.length)];
      if (pos.pnlPercent > 5) {
        this.emit('ai-message', { text: `📈 ${pos.name}: ${getHoldingPositivePhrase()}`, type: 'success' });
      } else if (pos.pnlPercent < -5) {
        this.emit('ai-message', { text: `⚠️ ${pos.name}: ${getHoldingNegativePhrase()}`, type: 'warning' });
      } else {
        this.emit('ai-message', { text: `🧠 ${getMarketPhrase(vars)}`, type: 'analysis' });
      }
    } else {
      // General market commentary
      this.emit('ai-message', { text: `🧠 ${getMarketPhrase(vars)}`, type: 'analysis' });
    }
  }

  _aiLearning() {
    if (!this.running) return;
    this.aiAccuracy = Math.min(95, this.aiAccuracy + (Math.random() * 0.8 - 0.2));

    // Alternate between learning and technical phrases
    if (Math.random() > 0.4) {
      const phrase = getLearningPhrase({ samples: this.history.length, accuracy: this.aiAccuracy.toFixed(1) });
      this.emit('ai-message', { text: `🔬 ${phrase}`, type: 'analysis' });
    } else {
      const phrase = getTechnicalPhrase({ latency: Math.floor(8 + Math.random() * 15) });
      this.emit('ai-message', { text: `⚙️ ${phrase}`, type: 'system' });
    }
  }

  getStats() {
    const totalPnl = this.history.reduce((s, t) => s + t.finalPnl, 0);
    const unrealizedPnl = Array.from(this.positions.values()).reduce((s, p) => s + p.pnl, 0);
    const wins = this.history.filter(t => t.finalPnl > 0).length;
    const losses = this.history.filter(t => t.finalPnl <= 0).length;
    const winRate = this.history.length > 0 ? (wins / this.history.length * 100).toFixed(1) : '0.0';

    // Today's profit = current total value - start balance
    const openPositionsValue = Array.from(this.positions.values()).reduce((s, p) => s + p.buyAmount, 0);
    const todayProfit = (this.balance + openPositionsValue + unrealizedPnl) - this.startBalance;

    return {
      balance: this.balance,
      startBalance: this.startBalance,
      totalPnl: todayProfit,
      unrealizedPnl,
      openPositions: this.positions.size,
      totalTrades: this.history.length,
      wins,
      losses,
      winRate,
      tokensSeenTotal: this.tokensSeenTotal,
      tokensPerMinute: this.tokensPerMinute,
      uptime: Date.now() - this.sessionStart,
      running: this.running,
      connected: this.connected,
      bestTrade: this.bestTrade,
      worstTrade: this.worstTrade,
      equityCurve: this.equityCurve,
      sessionGoal: this.config.sessionGoal,
      aiAccuracy: this.aiAccuracy,
      boostMode: this.boostMode,
    };
  }

  getPositions() {
    return Array.from(this.positions.values()).map(p => ({
      mint: p.mint, name: p.name, symbol: p.symbol,
      buyPrice: p.buyPrice, buyAmount: p.buyAmount, currentPrice: p.currentPrice,
      buyTime: p.buyTime, pnl: p.pnl, pnlPercent: p.pnlPercent,
      tokenAmount: p.tokenAmount,
      riskScore: p.riskScore, prediction: p.prediction, confidence: p.confidence,
      priceHistory: p._priceHistory || [],
    }));
  }

  getHistory() { return this.history.slice(0, 50); }
  getConfig() { return { ...this.config }; }

  updateConfig(newConfig) {
    Object.assign(this.config, newConfig);
    this.emit('ai-message', { text: '⚙️ Parameters updated. Applying new configuration.', type: 'info' });
  }
}

module.exports = { SniperEngine };
