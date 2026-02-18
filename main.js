// Chess game with full move legality (castling, en passant, promotion, check/checkmate)

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR";
const PIECE_SYMBOL = {
  P: "♙",
  R: "♖",
  N: "♘",
  B: "♗",
  Q: "♕",
  K: "♔",
  p: "♟",
  r: "♜",
  n: "♞",
  b: "♝",
  q: "♛",
  k: "♚",
};

const PIECE_VALUE = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100,
};

const PIECE_IMG = {
  w: {
    p: "pion.svg",
    r: "rock.svg",
    n: "knight.svg",
    b: "bishob.svg",
    q: "queen.svg",
    k: "king.svg",
  },
  b: {
    p: "pion.svg",
    r: "rock.svg",
    n: "knight.svg",
    b: "bishob.svg",
    q: "quenn.svg", // file name uses quenn for black
    k: "king.svg",
  },
};

let botDepth = 2;

const boardEl = document.getElementById("board");
const statusEl = document.getElementById("status");
const resetBtn = document.getElementById("resetBtn");
const botBtn = document.getElementById("botBtn");
const hintBtn = document.getElementById("hintBtn");
const depthSelect = document.getElementById("depthSelect");
const depthControl = document.getElementById("depthControl");
const pgnBox = document.getElementById("pgnBox");
const copyPgnBtn = document.getElementById("copyPgnBtn");
const welcomeOverlay = document.getElementById("welcomeOverlay");
const startWhiteBtn = document.getElementById("startWhite");
const startBlackBtn = document.getElementById("startBlack");
const startDepthSelect = document.getElementById("startDepth");

let state = createInitialState();
let selectedIndex = null;
let legalMoves = [];
let botEnabled = true;
let botColor = "b";
let playerColor = "w";
let boardFlipped = false;
let botThinking = false;
let lastMove = null;
let draggingFrom = null;
let dropCompleted = false;
let moveHistory = [];

if (depthSelect) {
  depthSelect.value = String(botDepth);
}
if (startDepthSelect) {
  startDepthSelect.value = String(botDepth);
}
updateBotLabel();

function createInitialState() {
  return {
    board: parseFEN(START_FEN),
    turn: "w",
    castling: {
      w: { K: true, Q: true },
      b: { K: true, Q: true },
    },
    enPassant: null,
    halfmove: 0,
    fullmove: 1,
  };
}

function parseFEN(fen) {
  const rows = fen.split("/");
  const board = new Array(64).fill(null);
  let idx = 0;
  for (const row of rows) {
    for (const ch of row) {
      if (/\d/.test(ch)) {
        idx += Number(ch);
      } else {
        board[idx] = {
          color: ch === ch.toUpperCase() ? "w" : "b",
          type: ch.toLowerCase(),
        };
        idx += 1;
      }
    }
  }
  return board;
}

function render() {
  const cellSize = boardEl.clientWidth / 8 || 0;
  boardEl.innerHTML = "";
  const order = boardFlipped ? Array.from({ length: 64 }, (_, i) => 63 - i) : Array.from({ length: 64 }, (_, i) => i);
  boardEl.classList.toggle("flipped", boardFlipped);
  for (const i of order) {
    const square = document.createElement("div");
    square.className = `square ${(Math.floor(i / 8) + (i % 8)) % 2 === 0 ? "light" : "dark"}`;
    square.dataset.index = i;

    if (lastMove) {
      if (lastMove.from === i) square.classList.add("last-from");
      if (lastMove.to === i) square.classList.add("last-dest");
    }

    const moveHint = legalMoves.find((m) => m.to === i);
    if (selectedIndex === i) square.classList.add("selected");
    if (moveHint) {
      if (state.board[i]) {
        square.classList.add("capture");
      } else {
        square.classList.add("legal");
      }
    }

    const piece = state.board[i];
    if (piece) {
      const pieceEl = document.createElement("div");
      pieceEl.className = `piece ${piece.color === "w" ? "white" : "black"}`;
      const img = document.createElement("img");
      img.src = pieceImage(piece);
      img.alt = pieceSymbol(piece);
      img.draggable = false;
      pieceEl.appendChild(img);
      pieceEl.draggable = true;
      pieceEl.addEventListener("dragstart", (e) => onDragStart(e, i));
      pieceEl.addEventListener("dragend", (e) => onDragEnd(e));
      square.appendChild(pieceEl);
      if (lastMove && lastMove.to === i) {
        pieceEl.classList.add("animate-pop");
        slidePiece(pieceEl, lastMove.from, lastMove.to, cellSize);
      }
    }

    square.addEventListener("click", () => onSquareClick(i));
    square.addEventListener("dragover", (e) => onDragOver(e, i));
    square.addEventListener("drop", (e) => onDrop(e, i));
    boardEl.appendChild(square);
  }

  updateStatus();
  maybeBotMove();
  applyHighlights();
  updatePgnBox();
}
  render();
function pieceSymbol(piece) {
  return piece.color === "w" ? piece.type.toUpperCase() : piece.type.toLowerCase();
}

function pieceImage(piece) {
  const file = PIECE_IMG[piece.color]?.[piece.type];
  if (!file) return "";
  return `./image/piesces/${piece.color === "w" ? "white" : "black"}/${file}`;
}

function onSquareClick(index) {
  if (botEnabled && botThinking) return;
  if (draggingFrom !== null) return;
  if (botEnabled && state.turn !== playerColor) return;

  const piece = state.board[index];
  if (selectedIndex === null) {
    if (piece && piece.color === state.turn) {
      selectedIndex = index;
      legalMoves = getLegalMoves(state, index);
    }
  } else {
    // attempt move
    const move = legalMoves.find((m) => m.to === index);
    if (move) {
      applyAndAdvance(move);
    } else {
      // new selection if same side
      if (piece && piece.color === state.turn) {
        selectedIndex = index;
        legalMoves = getLegalMoves(state, index);
      } else {
        selectedIndex = null;
        legalMoves = [];
      }
    }
  }
  render();
}

function onDragStart(event, index) {
  if (botEnabled && botThinking) {
    event.preventDefault();
    return;
  }
  if (botEnabled && state.turn !== playerColor) {
    event.preventDefault();
    return;
  }
  const piece = state.board[index];
  if (!piece || piece.color !== state.turn) {
    event.preventDefault();
    return;
  }
  draggingFrom = index;
  dropCompleted = false;
  selectedIndex = index;
  legalMoves = getLegalMoves(state, index);
  applyHighlights();
  if (event.dataTransfer) {
    event.dataTransfer.setData("text/plain", "move");
    event.dataTransfer.effectAllowed = "move";
    const img = new Image();
    img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="; // transparent
    event.dataTransfer.setDragImage(img, 0, 0);
  }
  const target = event.target.closest(".piece");
  if (target) target.classList.add("dragging");
}

function onDragOver(event, index) {
  if (draggingFrom === null) return;
  const move = legalMoves.find((m) => m.to === index);
  if (move) {
    event.preventDefault();
  }
}

function onDrop(event, index) {
  if (draggingFrom === null) return;
  event.preventDefault();
  const move = legalMoves.find((m) => m.to === index);
  if (move) {
    dropCompleted = true;
    applyAndAdvance(move);
    draggingFrom = null;
    render();
  } else {
    draggingFrom = null;
    selectedIndex = null;
    legalMoves = [];
    applyHighlights();
  }
}

function onDragEnd(event) {
  const target = event.target.closest(".piece");
  if (target) target.classList.remove("dragging");
  if (!dropCompleted) {
    draggingFrom = null;
    selectedIndex = null;
    legalMoves = [];
    applyHighlights();
  }
  dropCompleted = false;
}

function applyAndAdvance(move) {
  const mover = state.turn;
  state = applyMove(state, move);
  lastMove = move;
  recordMove(move, mover);
  selectedIndex = null;
  legalMoves = [];
  if (state.turn === "w") {
    state.fullmove += 1; // increment on Black->White transition already done in applyMove
  }
}

function applyMove(prev, move) {
  const next = cloneState(prev);
  const movingPiece = next.board[move.from];

  // handle en passant capture removal
  if (move.isEnPassant && move.capturedIndex !== undefined) {
    next.board[move.capturedIndex] = null;
  }

  // handle castling rook movement
  if (move.isCastle && move.rookFrom !== undefined) {
    next.board[move.rookTo] = next.board[move.rookFrom];
    next.board[move.rookFrom] = null;
  }

  // move piece
  next.board[move.to] = { color: movingPiece.color, type: move.promotion || movingPiece.type };
  next.board[move.from] = null;

  // update turn
  next.turn = prev.turn === "w" ? "b" : "w";

  // reset en passant by default
  next.enPassant = null;

  // set en passant target for double pawn push
  if (movingPiece.type === "p") {
    const diff = move.to - move.from;
    if (Math.abs(diff) === 16) {
      next.enPassant = move.from + diff / 2;
    }
  }

  // update castling rights
  updateCastlingRights(next, move, movingPiece);

  // halfmove clock reset on pawn move or capture
  if (movingPiece.type === "p" || move.isCapture) {
    next.halfmove = 0;
  } else {
    next.halfmove += 1;
  }

  return next;
}

function recordMove(move, moverColor) {
  moveHistory.push({
    color: moverColor,
    san: describeMove(move),
  });
}

function resetGame() {
  state = createInitialState();
  selectedIndex = null;
  legalMoves = [];
  lastMove = null;
  moveHistory = [];
  render();
}

function startGame(color) {
  playerColor = color;
  botColor = color === "w" ? "b" : "w";
  boardFlipped = color === "b";
  botEnabled = true;
  updateBotLabel();
  if (startDepthSelect && depthSelect) {
    botDepth = Number(startDepthSelect.value) || botDepth;
    depthSelect.value = String(botDepth);
  }
  hideWelcome();
  hideInGameControls();
  resetGame();
  if (botEnabled && state.turn === botColor) {
    maybeBotMove();
  }
}

function hideWelcome() {
  if (welcomeOverlay) welcomeOverlay.classList.add("hidden");
}

function hideInGameControls() {
  if (botBtn) botBtn.classList.add("hidden");
  if (hintBtn) hintBtn.classList.add("hidden");
  if (depthControl) depthControl.classList.add("hidden");
}

function updateBotLabel() {
  if (!botBtn) return;
  if (botEnabled) {
    const text = botColor === "w" ? "Bot: On (White)" : "Bot: On (Black)";
    botBtn.textContent = text;
  } else {
    botBtn.textContent = "Bot: Off";
  }
}

function slidePiece(el, fromIdx, toIdx, cellSize) {
  if (!cellSize || fromIdx === undefined || toIdx === undefined) return;
  const from = squareCoord(fromIdx, cellSize);
  const to = squareCoord(toIdx, cellSize);
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  el.style.transition = "none";
  el.style.transform = `translate(${dx}px, ${dy}px) scale(0.98)`;
  // force reflow so the browser registers the initial offset before animating back
  void el.getBoundingClientRect();
  requestAnimationFrame(() => {
    el.style.transition = "transform 240ms ease";
    el.style.transform = "translate(0px, 0px) scale(0.98)";
  });
}

function squareCoord(index, cellSize) {
  const x = (boardFlipped ? 7 - (index % 8) : index % 8) * cellSize;
  const y = (boardFlipped ? 7 - Math.floor(index / 8) : Math.floor(index / 8)) * cellSize;
  return { x, y };
}

function updateCastlingRights(stateObj, move, movingPiece) {
  const color = movingPiece.color;
  const opponent = color === "w" ? "b" : "w";
  const from = move.from;
  const to = move.to;

  // if king moves, lose both rights
  if (movingPiece.type === "k") {
    stateObj.castling[color].K = false;
    stateObj.castling[color].Q = false;
  }

  // rook moves from original squares
  const rookStarts = {
    w: { K: 63, Q: 56 },
    b: { K: 7, Q: 0 },
  };
  if (from === rookStarts[color].K) stateObj.castling[color].K = false;
  if (from === rookStarts[color].Q) stateObj.castling[color].Q = false;

  // rook captured on original squares
  if (move.isCapture) {
    if (to === rookStarts[opponent].K) stateObj.castling[opponent].K = false;
    if (to === rookStarts[opponent].Q) stateObj.castling[opponent].Q = false;
  }

  // castling move already implies king moved; handled above
}

function cloneState(s) {
  return {
    board: s.board.map((p) => (p ? { ...p } : null)),
    turn: s.turn,
    castling: {
      w: { ...s.castling.w },
      b: { ...s.castling.b },
    },
    enPassant: s.enPassant,
    halfmove: s.halfmove,
    fullmove: s.fullmove,
  };
}

function getLegalMoves(stateObj, index) {
  const piece = stateObj.board[index];
  if (!piece || piece.color !== stateObj.turn) return [];
  const pseudo = generatePseudoMoves(stateObj, index);
  const legal = [];
  for (const move of pseudo) {
    const next = applyMove(stateObj, move);
    if (!isKingInCheck(next, piece.color)) {
      legal.push(move);
    }
  }
  return legal;
}

function isKingInCheck(stateObj, color) {
  const kingIndex = stateObj.board.findIndex(
    (p) => p && p.color === color && p.type === "k"
  );
  if (kingIndex === -1) return false;
  const attacker = color === "w" ? "b" : "w";
  return isSquareAttacked(stateObj, kingIndex, attacker);
}

function generatePseudoMoves(stateObj, index) {
  const piece = stateObj.board[index];
  if (!piece) return [];
  switch (piece.type) {
    case "p":
      return pawnMoves(stateObj, index, piece.color);
    case "n":
      return knightMoves(stateObj, index, piece.color);
    case "b":
      return slidingMoves(stateObj, index, piece.color, [7, 9, -7, -9]);
    case "r":
      return slidingMoves(stateObj, index, piece.color, [8, -8, 1, -1]);
    case "q":
      return slidingMoves(stateObj, index, piece.color, [8, -8, 1, -1, 7, 9, -7, -9]);
    case "k":
      return kingMoves(stateObj, index, piece.color);
    default:
      return [];
  }
}

function pawnMoves(stateObj, index, color) {
  const moves = [];
  const dir = color === "w" ? -8 : 8;
  const startRow = color === "w" ? 6 : 1;
  const promotionRow = color === "w" ? 0 : 7;
  const row = Math.floor(index / 8);

  const one = index + dir;
  if (inBounds(one) && !stateObj.board[one]) {
    addPawnMove(moves, index, one, promotionRow);
    // double step
    if (row === startRow) {
      const two = index + dir * 2;
      if (!stateObj.board[two]) {
        moves.push({ from: index, to: two, isCapture: false });
      }
    }
  }

  // captures
  const caps = [dir - 1, dir + 1];
  for (const delta of caps) {
    const target = index + delta;
    if (!inBounds(target)) continue;
    const targetPiece = stateObj.board[target];
    if (targetPiece && targetPiece.color !== color) {
      addPawnMove(moves, index, target, promotionRow, true);
    }
    // en passant
    if (target === stateObj.enPassant) {
      const capturedIndex = target + (color === "w" ? 8 : -8);
      moves.push({
        from: index,
        to: target,
        isCapture: true,
        isEnPassant: true,
        capturedIndex,
      });
    }
  }

  return moves;
}

function addPawnMove(moves, from, to, promotionRow, isCapture = false) {
  const destRow = Math.floor(to / 8);
  if (destRow === promotionRow) {
    // Auto-promote to queen (like chess.com default quick promote)
    moves.push({ from, to, isCapture, promotion: "q" });
  } else {
    moves.push({ from, to, isCapture });
  }
}

function knightMoves(stateObj, index, color) {
  const moves = [];
  const deltas = [15, 17, -15, -17, 10, -10, 6, -6];
  for (const d of deltas) {
    const target = index + d;
    if (!inBounds(target)) continue;
    if (!isKnightDeltaValid(index, target)) continue;
    const piece = stateObj.board[target];
    if (!piece || piece.color !== color) {
      moves.push({ from: index, to: target, isCapture: !!piece });
    }
  }
  return moves;
}

function isKnightDeltaValid(from, to) {
  const fx = from % 8;
  const fy = Math.floor(from / 8);
  const tx = to % 8;
  const ty = Math.floor(to / 8);
  const dx = Math.abs(fx - tx);
  const dy = Math.abs(fy - ty);
  return (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
}

function slidingMoves(stateObj, index, color, deltas) {
  const moves = [];
  for (const delta of deltas) {
    const [dx, dy] = deltaToVector(delta);
    let current = index;
    while (true) {
      const next = stepIndex(current, dx, dy);
      if (next === null) break;
      const piece = stateObj.board[next];
      if (!piece) {
        moves.push({ from: index, to: next, isCapture: false });
      } else {
        if (piece.color !== color) {
          moves.push({ from: index, to: next, isCapture: true });
        }
        break;
      }
      current = next;
    }
  }
  return moves;
}

function kingMoves(stateObj, index, color) {
  const moves = [];
  const deltas = [1, -1, 8, -8, 7, -7, 9, -9];
  for (const d of deltas) {
    const target = index + d;
    if (!inBounds(target)) continue;
    if (!isKingDeltaValid(index, target)) continue;
    const piece = stateObj.board[target];
    if (!piece || piece.color !== color) {
      moves.push({ from: index, to: target, isCapture: !!piece });
    }
  }

  // Castling
  moves.push(...castleMoves(stateObj, index, color));
  return moves;
}

function isKingDeltaValid(from, to) {
  const fx = from % 8;
  const fy = Math.floor(from / 8);
  const tx = to % 8;
  const ty = Math.floor(to / 8);
  return Math.max(Math.abs(fx - tx), Math.abs(fy - ty)) === 1;
}

function castleMoves(stateObj, index, color) {
  const moves = [];
  const rights = stateObj.castling[color];
  const opponent = color === "w" ? "b" : "w";
  const rank = color === "w" ? 7 : 0;
  const kingStart = rank * 8 + 4;
  if (index !== kingStart) return moves;

  // Squares must not be in check
  if (isSquareAttacked(stateObj, kingStart, opponent)) return moves;

  // King-side
  if (rights.K) {
    const f = rank * 8 + 5;
    const g = rank * 8 + 6;
    if (!stateObj.board[f] && !stateObj.board[g]) {
      if (!isSquareAttacked(stateObj, f, opponent) && !isSquareAttacked(stateObj, g, opponent)) {
        moves.push({
          from: kingStart,
          to: g,
          isCapture: false,
          isCastle: true,
          rookFrom: rank * 8 + 7,
          rookTo: f,
        });
      }
    }
  }

  // Queen-side
  if (rights.Q) {
    const d = rank * 8 + 3;
    const c = rank * 8 + 2;
    const b = rank * 8 + 1;
    if (!stateObj.board[d] && !stateObj.board[c] && !stateObj.board[b]) {
      if (!isSquareAttacked(stateObj, d, opponent) && !isSquareAttacked(stateObj, c, opponent)) {
        moves.push({
          from: kingStart,
          to: c,
          isCapture: false,
          isCastle: true,
          rookFrom: rank * 8 + 0,
          rookTo: d,
        });
      }
    }
  }

  return moves;
}

function isSquareAttacked(stateObj, target, attackerColor) {
  // Pawn attacks
  const dir = attackerColor === "w" ? -8 : 8;
  const pawnCaptures = [dir - 1, dir + 1];
  for (const d of pawnCaptures) {
    const idx = target + d;
    if (!inBounds(idx)) continue;
    const p = stateObj.board[idx];
    if (p && p.color === attackerColor && p.type === "p") {
      if (Math.abs((idx % 8) - (target % 8)) === 1) return true;
    }
  }

  // Knights
  const knightD = [15, 17, -15, -17, 10, -10, 6, -6];
  for (const d of knightD) {
    const idx = target + d;
    if (!inBounds(idx)) continue;
    if (!isKnightDeltaValid(idx, target)) continue;
    const p = stateObj.board[idx];
    if (p && p.color === attackerColor && p.type === "n") return true;
  }

  // Kings (for castling path check)
  const kingD = [1, -1, 8, -8, 7, -7, 9, -9];
  for (const d of kingD) {
    const idx = target + d;
    if (!inBounds(idx)) continue;
    if (!isKingDeltaValid(idx, target)) continue;
    const p = stateObj.board[idx];
    if (p && p.color === attackerColor && p.type === "k") return true;
  }

  // Sliding pieces
  const sliderSets = [
    { deltas: [1, -1, 8, -8], types: ["r", "q"] },
    { deltas: [7, -7, 9, -9], types: ["b", "q"] },
  ];
  for (const set of sliderSets) {
    for (const d of set.deltas) {
      const [dx, dy] = deltaToVector(d);
      let current = target;
      while (true) {
        const next = stepIndex(current, dx, dy);
        if (next === null) break;
        const p = stateObj.board[next];
        if (p) {
          if (p.color === attackerColor && set.types.includes(p.type)) return true;
          break;
        }
        current = next;
      }
    }
  }

  return false;
}

function inBounds(idx) {
  return idx >= 0 && idx < 64;
}

function deltaToVector(delta) {
  switch (delta) {
    case 8:
      return [0, 1];
    case -8:
      return [0, -1];
    case 1:
      return [1, 0];
    case -1:
      return [-1, 0];
    case 7:
      return [-1, 1];
    case 9:
      return [1, 1];
    case -7:
      return [1, -1];
    case -9:
      return [-1, -1];
    default:
      return [0, 0];
  }
}

function stepIndex(index, dx, dy) {
  const x = (index % 8) + dx;
  const y = Math.floor(index / 8) + dy;
  if (x < 0 || x > 7 || y < 0 || y > 7) return null;
  return y * 8 + x;
}

function updateStatus() {
  const { inCheck, checkmate, stalemate } = evaluateBoard(state);
  if (checkmate) {
    statusEl.textContent = `${state.turn === "w" ? "Black" : "White"} wins by checkmate`;
  } else if (stalemate) {
    statusEl.textContent = "Draw by stalemate";
  } else if (inCheck) {
    statusEl.textContent = `${state.turn === "w" ? "White" : "Black"} to move (in check)`;
  } else {
    statusEl.textContent = `${state.turn === "w" ? "White" : "Black"} to move`;
  }
}

function applyHighlights() {
  const squares = boardEl.querySelectorAll(".square");
  squares.forEach((sq) => {
    const idx = Number(sq.dataset.index);
    sq.classList.remove("selected", "legal", "capture");
    if (idx === selectedIndex) sq.classList.add("selected");
    const move = legalMoves.find((m) => m.to === idx);
    if (move) {
      if (state.board[idx]) {
        sq.classList.add("capture");
      } else {
        sq.classList.add("legal");
      }
    }
  });
}

function generatePGN() {
  const result = getResultString();
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  const headers = [
    `[Event "Casual Game"]`,
    `[Site "Local"]`,
    `[Date "${yyyy}.${mm}.${dd}"]`,
    `[Round "-"]`,
    `[White "White"]`,
    `[Black "Black"]`,
    `[Result "${result}"]`,
  ];

  const moves = [];
  for (let i = 0; i < moveHistory.length; i += 1) {
    const entry = moveHistory[i];
    if (entry.color === "w") {
      const moveNumber = Math.floor(i / 2) + 1;
      const next = moveHistory[i + 1] && moveHistory[i + 1].color === "b" ? moveHistory[i + 1].san : null;
      if (next) {
        moves.push(`${moveNumber}. ${entry.san} ${next}`);
        i += 1;
      } else {
        moves.push(`${moveNumber}. ${entry.san}`);
      }
    }
  }

  return `${headers.join("\n")}\n\n${moves.join(" ")} ${result}`.trim();
}

function updatePgnBox() {
  if (!pgnBox) return;
  pgnBox.value = generatePGN();
}

function evaluateBoard(stateObj) {
  const color = stateObj.turn;
  const inCheck = isKingInCheck(stateObj, color);
  const hasMoves = playerHasLegalMove(stateObj, color);
  return {
    inCheck,
    checkmate: inCheck && !hasMoves,
    stalemate: !inCheck && !hasMoves,
  };
}

function getResultString() {
  const { checkmate, stalemate } = evaluateBoard(state);
  if (checkmate) return state.turn === "w" ? "0-1" : "1-0"; // side to move is mated
  if (stalemate) return "1/2-1/2";
  return "*";
}

function playerHasLegalMove(stateObj, color) {
  for (let i = 0; i < 64; i++) {
    const p = stateObj.board[i];
    if (p && p.color === color) {
      const moves = generatePseudoMoves(stateObj, i);
      for (const m of moves) {
        const next = applyMove(stateObj, m);
        if (!isKingInCheck(next, color)) return true;
      }
    }
  }
  return false;
}

function maybeBotMove() {
  if (!botEnabled) return;
  if (botThinking) return;
  if (state.turn !== botColor) return;
  const { checkmate, stalemate } = evaluateBoard(state);
  if (checkmate || stalemate) return;

  botThinking = true;
  statusEl.textContent = "Bot thinking...";
  setTimeout(() => {
    const mover = state.turn;
    const move = chooseBotMove(state, botColor);
    botThinking = false;
    if (!move) {
      render();
      return;
    }
    state = applyMove(state, move);
    lastMove = move;
    recordMove(move, mover);
    if (state.turn === "w") {
      state.fullmove += 1;
    }
    selectedIndex = null;
    legalMoves = [];
    render();
  }, 1000);
}

function chooseBotMove(stateObj, color) {
  const result = minimaxRoot(stateObj, color, botDepth);
  return result.move;
}

function minimaxRoot(stateObj, color, depth) {
  const moves = getAllLegalMoves(stateObj, color);
  if (moves.length === 0) return { move: null, score: -Infinity };

  let bestScore = -Infinity;
  let bestMoves = [];
  for (const move of moves) {
    const next = applyMove(stateObj, move);
    const score = minimax(next, depth - 1, color, -Infinity, Infinity);
    if (score > bestScore + 1e-6) {
      bestScore = score;
      bestMoves = [move];
    } else if (Math.abs(score - bestScore) < 1e-6) {
      bestMoves.push(move);
    }
  }
  const chosen = bestMoves[Math.floor(Math.random() * bestMoves.length)];
  return { move: chosen, score: bestScore };
}

function minimax(stateObj, depth, maximizingColor, alpha, beta) {
  const currentColor = stateObj.turn;

  if (depth === 0) {
    return evaluatePosition(stateObj, maximizingColor);
  }

  const moves = getAllLegalMoves(stateObj, currentColor);
  if (moves.length === 0) {
    const inCheck = isKingInCheck(stateObj, currentColor);
    if (inCheck) {
      // checkmate: bad for side to move
      const mateScore = 1000 - (botDepth - depth); // prefer faster mates
      return currentColor === maximizingColor ? -mateScore : mateScore;
    }
    // stalemate
    return 0;
  }

  if (currentColor === maximizingColor) {
    let value = -Infinity;
    for (const move of moves) {
      const next = applyMove(stateObj, move);
      value = Math.max(value, minimax(next, depth - 1, maximizingColor, alpha, beta));
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return value;
  } else {
    let value = Infinity;
    for (const move of moves) {
      const next = applyMove(stateObj, move);
      value = Math.min(value, minimax(next, depth - 1, maximizingColor, alpha, beta));
      beta = Math.min(beta, value);
      if (alpha >= beta) break;
    }
    return value;
  }
}

function evaluatePosition(stateObj, perspective) {
  let score = 0;
  const opponent = perspective === "w" ? "b" : "w";

  for (let i = 0; i < 64; i++) {
    const p = stateObj.board[i];
    if (!p) continue;
    const base = PIECE_VALUE[p.type] || 0;
    const center = centerWeight(i) * 0.2;
    const advancement = pawnAdvancementBonus(p, i) * 0.1;
    let val = base + center + advancement;
    if (p.type === "p") val += 0.05; // keep pawns slightly active
    if (p.color === perspective) score += val; else score -= val;
  }

  if (isKingInCheck(stateObj, perspective)) score -= 0.3;
  if (isKingInCheck(stateObj, opponent)) score += 0.3;

  // mobility
  const myMob = countLegalMovesForColor(stateObj, perspective);
  const oppMob = countLegalMovesForColor(stateObj, opponent);
  score += (myMob - oppMob) * 0.01;

  return score;
}

function centerWeight(index) {
  const x = index % 8;
  const y = Math.floor(index / 8);
  const dx = Math.abs(3.5 - x);
  const dy = Math.abs(3.5 - y);
  return 3 - (dx + dy);
}

function pawnAdvancementBonus(piece, index) {
  if (piece.type !== "p") return 0;
  const row = Math.floor(index / 8);
  return piece.color === "w" ? 6 - row : row - 1;
}

function countLegalMovesForColor(stateObj, color) {
  let total = 0;
  for (let i = 0; i < 64; i++) {
    const p = stateObj.board[i];
    if (p && p.color === color) {
      const pseudo = generatePseudoMoves(stateObj, i);
      for (const move of pseudo) {
        const next = applyMove(stateObj, move);
        if (!isKingInCheck(next, color)) total += 1;
      }
    }
  }
  return total;
}

function indexToCoord(index) {
  const file = "abcdefgh"[index % 8];
  const rank = 8 - Math.floor(index / 8);
  return `${file}${rank}`;
}

function describeMove(move) {
  if (move.isCastle) {
    return move.to % 8 === 6 ? "O-O" : "O-O-O";
  }
  const from = indexToCoord(move.from);
  const to = indexToCoord(move.to);
  const promo = move.promotion ? `=${move.promotion.toUpperCase()}` : "";
  return `${from}${to}${promo}`;
}

function getAllLegalMoves(stateObj, color) {
  const moves = [];
  if (stateObj.turn !== color) return moves;
  for (let i = 0; i < 64; i++) {
    const piece = stateObj.board[i];
    if (piece && piece.color === color) {
      const legal = getLegalMoves(stateObj, i);
      moves.push(...legal);
    }
  }
  return moves;
}

resetBtn.addEventListener("click", () => {
  resetGame();
});

botBtn.addEventListener("click", () => {
  botEnabled = !botEnabled;
  if (botEnabled) {
    botColor = playerColor === "w" ? "b" : "w";
    updateBotLabel();
    if (state.turn === botColor) {
      maybeBotMove();
    }
  } else {
    updateBotLabel();
  }
});

hintBtn.addEventListener("click", () => {
  if (botThinking) return;
  const { checkmate, stalemate } = evaluateBoard(state);
  if (checkmate || stalemate) {
    statusEl.textContent = "Game over - no moves";
    return;
  }
  const result = minimaxRoot(state, state.turn, botDepth);
  if (!result.move) {
    statusEl.textContent = "No legal moves";
    return;
  }
  statusEl.textContent = `Best: ${describeMove(result.move)} (score ${result.score.toFixed(2)})`;
});

depthSelect.addEventListener("change", () => {
  const val = Number(depthSelect.value);
  if (Number.isFinite(val) && val >= 1 && val <= 6) {
    botDepth = val;
  }
});

copyPgnBtn.addEventListener("click", async () => {
  if (!pgnBox) return;
  try {
    await navigator.clipboard.writeText(pgnBox.value);
    statusEl.textContent = "PGN copied";
  } catch (e) {
    statusEl.textContent = "Copy failed";
  }
});

startWhiteBtn.addEventListener("click", () => {
  botEnabled = true;
  startGame("w");
});

startBlackBtn.addEventListener("click", () => {
  botEnabled = true;
  startGame("b");
});

render();
