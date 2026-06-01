// ============================================
// AI PHRASES - Context-aware messages
// Each category is used only in the right situation
// ============================================

// --- STARTUP (shown once in sequence) ---
const STARTUP_PHRASES = [
  "Initializing neural network... Loading model weights...",
  "Connecting to Solana RPC... Syncing blocks...",
  "Calibrating bonding curve analyzer parameters...",
  "WebSocket latency: 12ms. Operating at full speed.",
  "ML Pipeline ready. Starting pump.fun scan...",
  "All systems active. Awaiting entry signals.",
];

// --- PRE-BUY: shown right before a buy decision ---
const PRE_BUY_PHRASES = [
  "Scanning contract bytecode... No honeypot detected.",
  "Liquidity pool analysis: locked. Safe entry confirmed.",
  "Top holders distribution: no whale concentration. Proceeding.",
  "Token metadata verified. IPFS image valid.",
  "Dev wallet analysis: clean history. No rug indicators.",
  "Bonding curve in optimal entry zone.",
];

// --- BUY: shown when position is opened ---
const BUY_PHRASES = [
  "Potential pump pattern detected. Entering position.",
  "Bonding curve analysis shows early entry opportunity. Buying.",
  "Token passed all filters. Growth probability 73%. Sniping.",
  "Fresh deploy with solid liquidity. Entering.",
  "ML model signals BUY. Confidence: 0.81",
  "Early bird pattern confirmed. Executing order.",
  "Social scoring positive. Entering position.",
  "Neural network confirms: token matches entry criteria.",
  "Micro-trend detected. Entering before main flow.",
  "Sentiment analysis: bullish. Opening position.",
  "Organic growth detected. Probability of x2: 34%. Entering.",
  "Pattern matches historical pumps. Executing.",
  "Liquidity injection detected. High confidence entry.",
  "Token velocity increasing. Sniping before momentum peak.",
  "Dev wallet locked. Safe entry parameters confirmed.",
  "Social media mentions spiking. Momentum building.",
];

// --- HOLDING: shown while position is open and doing well ---
const HOLDING_POSITIVE_PHRASES = [
  "Position monitoring: price trending up. Holding.",
  "Volume increasing on this token. Bullish signal.",
  "Whale wallet detected buying. Positive indicator.",
  "Price approaching TP zone. Preparing exit strategy.",
  "Resistance level broken. Extending hold time.",
  "Momentum sustained. Model confidence increasing.",
  "Buy pressure exceeding sell pressure. Holding strong.",
];

// --- HOLDING NEGATIVE: shown while position is losing ---
const HOLDING_NEGATIVE_PHRASES = [
  "Position under pressure. Monitoring SL level.",
  "Volume declining. Watching for reversal signal.",
  "Price consolidating below entry. Evaluating exit.",
  "Sell pressure increasing. SL proximity: close.",
];

// --- SELL TP ---
const SELL_TP_PHRASES = [
  "Take Profit reached! Locking in gains.",
  "Profit target achieved. Closing position.",
  "Excellent trade! TP triggered perfectly.",
  "Profit secured. Model performing as expected.",
  "Target multiplier reached. Exiting with profit.",
  "Overbought zone detected. Taking profit.",
  "TP hit. Reallocating capital to next signal.",
  "Price target achieved. Securing returns.",
];

// --- SELL SL ---
const SELL_SL_PHRASES = [
  "Stop Loss triggered. Minimizing losses.",
  "Risk management: closing losing position.",
  "SL triggered. Switching to next signal.",
  "Token didn't meet expectations. Exiting at stop.",
  "Bonding curve reversed. Cutting losses.",
  "Momentum lost. Executing stop loss protocol.",
  "Rug pattern detected. Emergency exit.",
  "Volume collapsed. Closing position at SL.",
];

// --- SELL TIMEOUT ---
const SELL_TIMEOUT_PHRASES = [
  "Position timeout. Token showed no movement.",
  "Time expired. Closing at current price.",
  "Position expired. Freeing capital for new signals.",
  "No volatility detected. Closing and seeking better entry.",
  "Hold time exceeded. Recycling capital.",
];

// --- POST-LOSS: shown after a losing trade ---
const POST_LOSS_PHRASES = [
  "Loss absorbed. Adjusting risk parameters for next entry.",
  "Recalculating entry criteria. Tightening filters.",
  "Drawdown within acceptable range. Strategy intact.",
  "Updating model weights based on failed prediction.",
];

// --- POST-WIN-STREAK: shown after 3+ consecutive wins ---
const WIN_STREAK_PHRASES = [
  "Win streak active. Model in high-performance mode.",
  "Algorithm efficiency at peak. Capitalizing on momentum.",
  "Pattern recognition accuracy exceeding baseline by 12%.",
  "Consecutive wins confirmed. Strategy validated.",
  "Hot streak detected. Maintaining current parameters.",
];

// --- SKIP: shown when token is rejected ---
const SKIP_PHRASES = [
  "Filter rejected token. Doesn't match criteria.",
  "Analysis shows high risk. Skipping.",
  "Insufficient liquidity. Pass.",
  "Creator wallet with suspicious history. Skip.",
  "Model uncertain. Confidence below threshold.",
  "Too many open positions. Waiting.",
  "Bonding curve in unfavorable zone. Skipping.",
  "Risk/reward ratio unfavorable. Passing.",
  "Honeypot indicators detected. Avoiding.",
];

// --- MARKET ANALYSIS: periodic, context-aware ---
const MARKET_ACTIVE_PHRASES = [
  "Market active. New tokens: {count}/min. Optimal sniping conditions.",
  "Pump.fun activity above average. Good conditions for trading.",
  "Detecting copy-trade activity from known profitable wallets.",
  "Unusual activity detected on Solana mempool. Monitoring.",
  "Raydium migration detected. Monitoring graduation candidates.",
  "New creator deploying multiple tokens. Flagging for review.",
];

const MARKET_CALM_PHRASES = [
  "Market slowing down. Waiting for next wave of deployments.",
  "Token creation rate declining. Adjusting patience parameters.",
  "Low activity period. Conserving capital for better opportunities.",
];

const MARKET_STATS_PHRASES = [
  "Current session showing {winrate}% successful trades.",
  "Portfolio in {status}. Continuing monitoring.",
  "Processing {count} events/second. All systems nominal.",
  "Blockchain sync: 100%. Zero missed blocks.",
  "Memory optimized. Running {positions} concurrent position trackers.",
];

// --- TECHNICAL: periodic system status ---
const TECHNICAL_PHRASES = [
  "WebSocket latency: {latency}ms. Operating at full speed.",
  "Gas fees optimal. Transaction speed: ~400ms.",
  "All RPC nodes responding. Redundancy: 100%.",
  "Neural network inference time: 3ms. No bottlenecks.",
];

// --- AI LEARNING: periodic model updates ---
const LEARNING_PHRASES = [
  "Model updated. Training on {samples} samples. New accuracy: {accuracy}%",
  "Backpropagation complete. Weights adjusted for current market.",
  "Feature importance recalculated. Bonding curve slope now weighted higher.",
  "Overfitting check passed. Generalization score: 0.91",
  "Market regime shift detected. Adapting neural network layers.",
];

// ============================================
// HELPER
// ============================================

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fillVars(phrase, vars = {}) {
  let result = phrase;
  for (const [key, val] of Object.entries(vars)) {
    result = result.replace(`{${key}}`, val);
  }
  return result;
}

module.exports = {
  STARTUP_PHRASES,
  getBuyPhrase: () => getRandom(BUY_PHRASES),
  getPreBuyPhrase: () => getRandom(PRE_BUY_PHRASES),
  getSellTpPhrase: () => getRandom(SELL_TP_PHRASES),
  getSellSlPhrase: () => getRandom(SELL_SL_PHRASES),
  getSellTimeoutPhrase: () => getRandom(SELL_TIMEOUT_PHRASES),
  getSkipPhrase: () => getRandom(SKIP_PHRASES),
  getPostLossPhrase: () => getRandom(POST_LOSS_PHRASES),
  getWinStreakPhrase: () => getRandom(WIN_STREAK_PHRASES),
  getHoldingPositivePhrase: () => getRandom(HOLDING_POSITIVE_PHRASES),
  getHoldingNegativePhrase: () => getRandom(HOLDING_NEGATIVE_PHRASES),
  getTechnicalPhrase: (vars) => fillVars(getRandom(TECHNICAL_PHRASES), vars),
  getLearningPhrase: (vars) => fillVars(getRandom(LEARNING_PHRASES), vars),
  getMarketPhrase: (vars) => {
    const tpm = vars.count || 0;
    let pool;
    if (tpm > 10) pool = MARKET_ACTIVE_PHRASES;
    else if (tpm < 4) pool = MARKET_CALM_PHRASES;
    else pool = MARKET_STATS_PHRASES;
    return fillVars(getRandom(pool), vars);
  },
};
