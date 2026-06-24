// =========================================================
//                   LEVEL EDITOR SCENE
// =========================================================
// Éditeur de niveaux visuel.
// JSON produit : { playerStart, blueCircle, platforms,
//                  icePlatforms, spikes, redCircles, redSquares }
// =========================================================

import { gameVolume, colorPlayer } from "../globals.js";

// ── Constantes ────────────────────────────────────────────
const CELL       = 20;          // taille d'une cellule dans l'éditeur (grille fine)
const GAME_SCALE = 2;           // 1 case éditeur (20px) = 40px en jeu → on multiplie/divise par 2
const PANEL      = 200;         // largeur du panneau droit
const GRID_W     = 800 - PANEL; // 600 → largeur réelle de la zone de jeu (zone de fond)
const COLS       = 20;          // nombre de colonnes affichées (20 × 20px = 400px)
const ROWS       = 15;          // nombre de lignes affichées (15 × 20px = 300px)
const GRID_PX_W  = COLS * CELL; // 400 → largeur de la grille affichée
const GRID_PX_H  = ROWS * CELL; // 300 → hauteur de la grille affichée
const GRID_TOP   = 600 - GRID_PX_H; // offset Y pour ancrer la grille en bas de la zone de jeu

const TOOLS = [
  { id: "platform",    label: "Plateforme",    color: 0xA0522D, icon: "▬" },
  { id: "ice",         label: "Glace",         color: 0x9EE7FF, icon: "🧊" },
  { id: "spike",       label: "Pique",         color: 0xFF0000, icon: "▲" },
  { id: "redCircle",   label: "Balle",         color: 0xFF4444, icon: "●" },
  { id: "redSquare",   label: "Carré ennemi",  color: 0xFF2222, icon: "■" },
  { id: "player",      label: "Départ joueur", color: 0xAA66CC, icon: "P" },
  { id: "exit",        label: "Sortie",        color: 0x0000FF, icon: "O" },
  { id: "eraser",      label: "Gomme",         color: 0x888888, icon: "✕" },
];

// Options par défaut pour chaque type
const DEFAULTS = {
  platform:  { w: CELL, h: CELL, color: "0xA0522D" },
  ice:       { w: CELL, h: CELL },
  spike:     { orientation: "up" },
  redCircle: { rise: 100, direction: "up" },
  redSquare: { rise: 100, direction: "right" },
};

// ── Clé localStorage ─────────────────────────────────────
const LS_KEY = "jumpix_editorLevel";

// ── Utilitaires ───────────────────────────────────────────
function snapToGrid(val) { return Math.floor(val / CELL) * CELL; }
function cellCol(x)      { return Math.floor(x / CELL); }
function cellRow(y)      { return Math.floor((y - GRID_TOP) / CELL); } // tient compte de l'ancrage en bas
function cellKey(col, row) { return `${col}_${row}`; }
function colToX(col)     { return col * CELL; }
function rowToY(row)     { return row * CELL + GRID_TOP; } // position écran (tient compte de l'ancrage en bas)

// =========================================================
export class LevelEditorScene extends Phaser.Scene {
  constructor() { super("LevelEditorScene"); }

  // ── Init ──────────────────────────────────────────────
  init(data) {
    this.importedLevel = data?.level ?? null;
  }

  // ── Create ────────────────────────────────────────────
  create() {
    this.selectedTool = "platform";
    this.objects      = new Map();  // cellKey → { type, props, gfx }
    this.playerPos    = null;       // { col, row }
    this.exitPos      = null;
    this.selectedCell = null;       // cellule sélectionnée pour propriétés

    this._buildBackground();
    this._buildGrid();
    this._buildPanel();
    this._buildTopBar();
    this._bindInput();

    // Import JSON si passé en paramètre, sinon restaurer depuis localStorage
    if (this.importedLevel) {
      this._importLevel(this.importedLevel);
    } else {
      const saved = this._loadFromStorage();
      if (saved) this._importLevel(saved);
    }
  }

  // ── Fond & grille ─────────────────────────────────────
  _buildBackground() {
    // Fond zone de jeu
    this.add.rectangle(GRID_W / 2, 300, GRID_W, 600, 0x222233);
    // Fond panneau
    this.add.rectangle(GRID_W + PANEL / 2, 300, PANEL, 600, 0x1a1a2e)
      .setStrokeStyle(2, 0x00BFFF);
  }

  _buildGrid() {
    const g = this.add.graphics();
    g.lineStyle(1, 0x334455, 0.6);

    for (let c = 0; c <= COLS; c++) {
      g.lineBetween(c * CELL, GRID_TOP, c * CELL, GRID_TOP + GRID_PX_H);
    }
    for (let r = 0; r <= ROWS; r++) {
      g.lineBetween(0, GRID_TOP + r * CELL, GRID_PX_W, GRID_TOP + r * CELL);
    }
  }

  // ── Panneau droit ─────────────────────────────────────
  _buildPanel() {
    const px = GRID_W + 10;
    let  py  = 40;

    this.add.text(GRID_W + PANEL / 2, py, "OBJETS", {
      fontSize: "18px", color: "#00BFFF", fontStyle: "bold"
    }).setOrigin(0.5);
    py += 30;

    this.toolBtns = {};

    TOOLS.forEach(t => {
      const bg = this.add.rectangle(GRID_W + PANEL / 2, py, PANEL - 16, 32,
        this.selectedTool === t.id ? 0x005577 : 0x112233)
        .setStrokeStyle(1, 0x00BFFF)
        .setInteractive();

      const txt = this.add.text(GRID_W + PANEL / 2, py, `${t.icon} ${t.label}`, {
        fontSize: "13px", color: "#ffffff"
      }).setOrigin(0.5);

      bg.on("pointerover",  () => { if (this.selectedTool !== t.id) bg.setFillStyle(0x003344); });
      bg.on("pointerout",   () => { if (this.selectedTool !== t.id) bg.setFillStyle(0x112233); });
      bg.on("pointerdown",  () => this._selectTool(t.id));

      this.toolBtns[t.id] = { bg, txt };
      py += 40;
    });

    // Séparateur
    py += 5;
    this.add.graphics().lineStyle(1, 0x00BFFF, 0.4).lineBetween(GRID_W + 8, py, 798, py);
    py += 10;

    // Zone propriétés (créée dynamiquement)
    this.propZoneY  = py;
    this.propLabels = [];
    this._drawPropsPanel(null);

    // Séparateur bas
    this.add.graphics().lineStyle(1, 0x00BFFF, 0.4).lineBetween(GRID_W + 8, 520, 798, 520);

    // JSON Export
    const exportBtn = this.add.text(GRID_W + PANEL / 2, 540, "📋 Copier JSON", {
      fontSize: "13px", color: "#ffffff",
      backgroundColor: "#007700", padding: { x: 8, y: 6 }
    }).setOrigin(0.5).setInteractive();
    exportBtn.on("pointerdown", () => this._exportJSON());

    // Jouer le niveau
    const playBtn = this.add.text(GRID_W + PANEL / 2, 572, "▶ Jouer", {
      fontSize: "13px", color: "#ffffff",
      backgroundColor: "#005599", padding: { x: 8, y: 6 }
    }).setOrigin(0.5).setInteractive();
    playBtn.on("pointerdown", () => this._playLevel());
  }

  // ── Barre du haut ─────────────────────────────────────
  _buildTopBar() {
    // Bouton retour
    const back = this.add.text(5, 5, "←", {
      fontSize: "22px", color: "#ffffff",
      backgroundColor: "#00BFFF", padding: { x: 7, y: 3 }
    }).setInteractive();
    back.on("pointerdown", () => {
      this.sound.play("menu", { volume: gameVolume });
      this.scene.start("MenuScene");
    });

    this.add.text(GRID_W / 2, 10, "ÉDITEUR DE NIVEAU", {
      fontSize: "18px", color: "#00BFFF", fontStyle: "bold"
    }).setOrigin(0.5, 0);

    // Bouton Import JSON via DOM
    const importBtn = this.add.text(GRID_W - 5, 5, "📂 Importer JSON", {
      fontSize: "13px", color: "#ffffff",
      backgroundColor: "#555500", padding: { x: 6, y: 4 }
    }).setOrigin(1, 0).setInteractive();
    importBtn.on("pointerdown", () => this._openImportDialog());

    // Bouton Clear
    const clearBtn = this.add.text(GRID_W - 5, 32, "🗑 Effacer tout", {
      fontSize: "13px", color: "#ffffff",
      backgroundColor: "#660000", padding: { x: 6, y: 4 }
    }).setOrigin(1, 0).setInteractive();
    clearBtn.on("pointerdown", () => this._clearAll());
  }

  // ── Sélection d'outil ─────────────────────────────────
  _selectTool(id) {
    if (this.toolBtns[this.selectedTool]) {
      this.toolBtns[this.selectedTool].bg.setFillStyle(0x112233);
    }
    this.selectedTool = id;
    this.toolBtns[id].bg.setFillStyle(0x005577);
    this.selectedCell = null;
    this._drawPropsPanel(null);
  }

  // ── Saisie souris ─────────────────────────────────────
  _bindInput() {
    this.isPointerDown = false;

    const inGrid = ptr => ptr.x >= 0 && ptr.x < GRID_PX_W && ptr.y >= GRID_TOP && ptr.y < GRID_TOP + GRID_PX_H;

    this.input.on("pointerdown", ptr => {
      if (!inGrid(ptr)) return; // hors de la grille (panneau ou zone vide)
      this.isPointerDown = true;
      this._handleCell(ptr.x, ptr.y, true);
    });

    this.input.on("pointermove", ptr => {
      if (!this.isPointerDown || !inGrid(ptr)) return;
      // En mode peinture continue seulement pour platform / ice / eraser
      if (["platform","ice","eraser"].includes(this.selectedTool)) {
        this._handleCell(ptr.x, ptr.y, false);
      }
    });

    this.input.on("pointerup", () => { this.isPointerDown = false; });
  }

  _handleCell(px, py, isClick) {
    const col = cellCol(px);
    const row = cellRow(py);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

    const key = cellKey(col, row);

    if (this.selectedTool === "eraser") {
      this._removeCell(key);
      return;
    }

    if (this.selectedTool === "player") {
      // Déplacer le spawn
      if (this.playerPos) this._redrawCell(this.playerPos);
      this.playerPos = { col, row };
      this._drawSpecial(col, row, 0xAA66CC, "P");
      this.selectedCell = null;
      this._drawPropsPanel(null);
      this._saveToStorage();
      return;
    }

    if (this.selectedTool === "exit") {
      if (this.exitPos) this._redrawCell(this.exitPos);
      this.exitPos = { col, row };
      this._drawSpecial(col, row, 0x0000FF, "O");
      this.selectedCell = null;
      this._drawPropsPanel(null);
      this._saveToStorage();
      return;
    }

    // Clic sur une cellule existante → sélectionner
    if (isClick && this.objects.has(key)) {
      const obj = this.objects.get(key);
      if (obj.type === this.selectedTool || this.selectedTool !== "eraser") {
        this.selectedCell = key;
        this._drawPropsPanel(key);
        this._highlightSelected(key);
        return;
      }
    }

    // Placer l'objet
    if (!this.objects.has(key)) {
      this._placeObject(col, row, key);
    } else if (isClick) {
      // Clic sur existant → sélectionner
      this.selectedCell = key;
      this._drawPropsPanel(key);
      this._highlightSelected(key);
    }
  }

  _placeObject(col, row, key) {
    const tool = this.selectedTool;
    const props = JSON.parse(JSON.stringify(DEFAULTS[tool] || {}));

    const gfx = this.add.graphics();
    this._renderObject(gfx, col, row, tool, props);

    this.objects.set(key, { type: tool, col, row, props, gfx });
    this.selectedCell = key;
    this._drawPropsPanel(key);
    this._highlightSelected(key);
    this._saveToStorage();
  }

  _renderObject(gfx, col, row, type, props) {
    gfx.clear();
    const x = colToX(col);
    const y = rowToY(row);

    gfx.lineStyle(0);
    switch (type) {
      case "platform": {
        const c = typeof props.color === "string" ? parseInt(props.color) : (props.color || 0xA0522D);
        gfx.fillStyle(c, 1).fillRect(x, y, CELL, CELL);
        break;
      }
      case "ice":
        gfx.fillStyle(0x9EE7FF, 1).fillRect(x, y, CELL, CELL);
        gfx.fillStyle(0xFFFFFF, 0.5).fillRect(x, y, CELL, 3);
        break;
      case "spike": {
        gfx.fillStyle(0xFF0000, 1);
        const h = Math.sqrt(3) / 2 * CELL;
        gfx.beginPath();
        const ori = props.orientation || "up";
        if (ori === "up") {
          gfx.moveTo(x + CELL / 2, y); gfx.lineTo(x, y + h); gfx.lineTo(x + CELL, y + h);
        } else if (ori === "down") {
          gfx.moveTo(x + CELL / 2, y + h); gfx.lineTo(x, y); gfx.lineTo(x + CELL, y);
        } else if (ori === "left") {
          gfx.moveTo(x, y + CELL / 2); gfx.lineTo(x + h, y); gfx.lineTo(x + h, y + CELL);
        } else {
          gfx.moveTo(x + h, y + CELL / 2); gfx.lineTo(x, y); gfx.lineTo(x, y + CELL);
        }
        gfx.closePath(); gfx.fillPath();
        break;
      }
      case "redCircle":
        gfx.fillStyle(0xFF0000, 1).fillCircle(x + CELL / 2, y + CELL / 2, CELL / 2);
        gfx.lineStyle(2, 0xFFAAAA).strokeCircle(x + CELL / 2, y + CELL / 2, CELL / 2);
        break;
      case "redSquare":
        gfx.fillStyle(0xFF2222, 1).fillRect(x, y, CELL, CELL);
        gfx.lineStyle(2, 0xFF8888).strokeRect(x, y, CELL, CELL);
        break;
    }
  }

  _drawSpecial(col, row, color, letter) {
    const key = cellKey(col, row);
    // Retire un objet existant à cette case si besoin
    if (this.objects.has(key)) this._removeCell(key);

    const gfx = this.add.graphics();
    const x = colToX(col), y = rowToY(row);
    gfx.fillStyle(color, 0.8).fillCircle(x + CELL / 2, y + CELL / 2, CELL / 2);
    const lbl = this.add.text(x + CELL / 2, y + CELL / 2, letter, {
      fontSize: "11px", color: "#ffffff", fontStyle: "bold"
    }).setOrigin(0.5);

    // On stocke le label pour pouvoir le détruire
    if (color === 0xAA66CC) {
      if (this._playerGfx) { this._playerGfx.destroy(); }
      if (this._playerLbl) { this._playerLbl.destroy(); }
      this._playerGfx = gfx; this._playerLbl = lbl;
    } else {
      if (this._exitGfx) { this._exitGfx.destroy(); }
      if (this._exitLbl) { this._exitLbl.destroy(); }
      this._exitGfx = gfx; this._exitLbl = lbl;
    }
  }

  _redrawCell(pos) {
    if (!pos) return;
    const key = cellKey(pos.col, pos.row);
    if (this.objects.has(key)) {
      const obj = this.objects.get(key);
      this._renderObject(obj.gfx, obj.col, obj.row, obj.type, obj.props);
    }
  }

  _removeCell(key) {
    if (!this.objects.has(key)) return;
    const obj = this.objects.get(key);
    obj.gfx.destroy();
    this.objects.delete(key);
    if (this.selectedCell === key) {
      this.selectedCell = null;
      this._drawPropsPanel(null);
    }
    if (this._selHighlight) { this._selHighlight.destroy(); this._selHighlight = null; }
    this._saveToStorage();
  }

  _highlightSelected(key) {
    if (this._selHighlight) { this._selHighlight.destroy(); this._selHighlight = null; }
    if (!key || !this.objects.has(key)) return;
    const { col, row } = this.objects.get(key);
    const g = this.add.graphics();
    g.lineStyle(2, 0xFFFF00, 1).strokeRect(colToX(col) + 1, rowToY(row) + 1, CELL - 2, CELL - 2);
    this._selHighlight = g;
  }

  // ── Panneau propriétés ────────────────────────────────
  _drawPropsPanel(key) {
    // Nettoyer anciens labels
    (this.propLabels || []).forEach(o => o.destroy());
    this.propLabels = [];

    const px = GRID_W + PANEL / 2;
    let   py = this.propZoneY;

    const label = (txt, color = "#aaaaaa") => {
      const t = this.add.text(px, py, txt, { fontSize: "12px", color }).setOrigin(0.5);
      this.propLabels.push(t);
      py += 18;
      return t;
    };

    if (!key || !this.objects.has(key)) {
      label("── Propriétés ──", "#556677");
      label("Cliquez un objet", "#556677");
      label("pour l'éditer.", "#556677");
      return;
    }

    const obj = this.objects.get(key);
    const { type, props } = obj;

    label(`── ${TOOLS.find(t => t.id === type)?.label || type} ──`, "#00BFFF");

    if (type === "spike") {
      label("Orientation :", "#cccccc");
      ["up","down","left","right"].forEach(ori => {
        const active = (props.orientation || "up") === ori;
        const icon   = { up:"▲", down:"▽", left:"◁", right:"▷" }[ori];
        const btn = this.add.text(px + (["up","right"].includes(ori) ? 20 : -20), py,
          `${icon} ${ori}`, {
            fontSize: "12px",
            color: active ? "#00FF99" : "#ffffff",
            backgroundColor: active ? "#003322" : "#222222",
            padding: { x: 4, y: 3 }
          }).setOrigin(0.5).setInteractive();
        btn.on("pointerdown", () => {
          props.orientation = ori;
          this._renderObject(obj.gfx, obj.col, obj.row, type, props);
          this._drawPropsPanel(key);
          this._saveToStorage();
        });
        this.propLabels.push(btn);
        if (ori === "up" || ori === "left") py += 22;
      });
      py += 8;
    }

    if (type === "redCircle" || type === "redSquare") {
      label("Distance (px) :", "#cccccc");

      const riseBtn = (delta) => {
        const b = this.add.text(px + (delta > 0 ? 30 : -30), py, delta > 0 ? "+" : "−", {
          fontSize: "18px", color: "#ffffff",
          backgroundColor: "#333333", padding: { x: 8, y: 3 }
        }).setOrigin(0.5).setInteractive();
        b.on("pointerdown", () => {
          props.rise = Math.max(20, Math.min(400, (props.rise || 100) + delta));
          this._drawPropsPanel(key);
          this._saveToStorage();
        });
        this.propLabels.push(b);
      };

      riseBtn(-20); riseBtn(+20);
      const riseVal = this.add.text(px, py, `${props.rise || 100}`, {
        fontSize: "15px", color: "#FFD700"
      }).setOrigin(0.5);
      this.propLabels.push(riseVal);
      py += 26;

      label("Direction :", "#cccccc");
      const dirs = type === "redCircle" ? ["up","down"] : ["right","left"];
      dirs.forEach(dir => {
        const active = (props.direction || dirs[0]) === dir;
        const icon = { up:"▲", down:"▽", left:"◁", right:"▷" }[dir];
        const btn = this.add.text(px + (dir === dirs[0] ? -25 : 25), py,
          `${icon}`, {
            fontSize: "16px",
            color: active ? "#00FF99" : "#ffffff",
            backgroundColor: active ? "#003322" : "#222222",
            padding: { x: 8, y: 4 }
          }).setOrigin(0.5).setInteractive();
        btn.on("pointerdown", () => {
          props.direction = dir;
          this._drawPropsPanel(key);
          this._saveToStorage();
        });
        this.propLabels.push(btn);
      });
      py += 26;
    }

    if (type === "platform") {
      label("Couleur :", "#cccccc");
      const colors = [
        { hex: "0xA0522D", name: "Marron" },
        { hex: "0x226546", name: "Vert" },
        { hex: "0x555555", name: "Gris" },
        { hex: "0x7A0000", name: "Rouge" },
        { hex: "0x0B228A", name: "Bleu" },
      ];
      colors.forEach((c, i) => {
        const xOff = (i - 2) * 34;
        const swatch = this.add.rectangle(px + xOff, py, 24, 20, parseInt(c.hex))
          .setStrokeStyle(props.color === c.hex ? 2 : 0, 0xFFFFFF)
          .setInteractive();
        swatch.on("pointerdown", () => {
          props.color = c.hex;
          this._renderObject(obj.gfx, obj.col, obj.row, type, props);
          this._drawPropsPanel(key);
          this._saveToStorage();
        });
        this.propLabels.push(swatch);
      });
      py += 28;
    }

    // Bouton supprimer
    py += 4;
    const del = this.add.text(px, py, "🗑 Supprimer", {
      fontSize: "12px", color: "#ffffff",
      backgroundColor: "#660000", padding: { x: 8, y: 4 }
    }).setOrigin(0.5).setInteractive();
    del.on("pointerdown", () => {
      this._removeCell(key);
    });
    this.propLabels.push(del);
  }

  // ── Effacer tout ──────────────────────────────────────
  _clearAll() {
    for (const [, obj] of this.objects) { obj.gfx.destroy(); }
    this.objects.clear();
    this.playerPos = null;
    this.exitPos   = null;
    this.selectedCell = null;
    if (this._playerGfx) { this._playerGfx.destroy(); this._playerGfx = null; }
    if (this._playerLbl) { this._playerLbl.destroy(); this._playerLbl = null; }
    if (this._exitGfx)   { this._exitGfx.destroy();   this._exitGfx   = null; }
    if (this._exitLbl)   { this._exitLbl.destroy();    this._exitLbl   = null; }
    if (this._selHighlight) { this._selHighlight.destroy(); this._selHighlight = null; }
    this._drawPropsPanel(null);
    this._saveToStorage();
  }

  // ── Génération du JSON ────────────────────────────────
  // Toutes les coordonnées/tailles de l'éditeur (grille 20px) sont
  // multipliées par GAME_SCALE pour produire des coordonnées de jeu
  // basées sur des blocs de 40px.
  _buildLevelJSON() {
    const level = {
      playerStart:  { x: 40, y: 540 },
      blueCircle:   { x: 560, y: 540 },
      platforms:    [],
      icePlatforms: [],
      spikes:       [],
      redCircles:   [],
      redSquares:   [],
    };

    if (this.playerPos) {
      level.playerStart = {
        x: (this.playerPos.col * CELL + CELL / 2) * GAME_SCALE,
        y: (this.playerPos.row * CELL + CELL / 2) * GAME_SCALE
      };
    }
    if (this.exitPos) {
      level.blueCircle = {
        x: (this.exitPos.col * CELL + CELL / 2) * GAME_SCALE,
        y: (this.exitPos.row * CELL + CELL / 2) * GAME_SCALE
      };
    }

    // Fusionner les plateformes horizontales adjacentes
    const usedPlatform = new Set();
    const usedIce      = new Set();

    for (const [key, obj] of this.objects) {
      if (obj.type === "platform" && !usedPlatform.has(key)) {
        // Agréger vers la droite
        let w = CELL;
        let c = obj.col + 1;
        let nk = cellKey(c, obj.row);
        while (this.objects.has(nk) && this.objects.get(nk).type === "platform"
               && !usedPlatform.has(nk)) {
          usedPlatform.add(nk); w += CELL; c++; nk = cellKey(c, obj.row);
        }
        usedPlatform.add(key);
        const colorHex = obj.props.color || "0xA0522D";
        level.platforms.push({
          x: obj.col * CELL * GAME_SCALE,
          y: obj.row * CELL * GAME_SCALE,
          w: w * GAME_SCALE,
          h: CELL * GAME_SCALE,
          color: colorHex
        });
      }

      if (obj.type === "ice" && !usedIce.has(key)) {
        let w = CELL;
        let c = obj.col + 1;
        let nk = cellKey(c, obj.row);
        while (this.objects.has(nk) && this.objects.get(nk).type === "ice"
               && !usedIce.has(nk)) {
          usedIce.add(nk); w += CELL; c++; nk = cellKey(c, obj.row);
        }
        usedIce.add(key);
        level.icePlatforms.push({
          x: obj.col * CELL * GAME_SCALE,
          y: obj.row * CELL * GAME_SCALE,
          w: w * GAME_SCALE,
          h: CELL * GAME_SCALE
        });
      }

      if (obj.type === "spike") {
        // Le point d'ancrage (x, y) dépend de l'orientation, car createRedTriangle()
        // utilise une origine différente selon le sens du pique :
        //   up    → origine [0.5, 1] → point bas-centre de la case
        //   down  → origine [0.5, 0] → point haut-centre de la case
        //   left  → origine [1, 0.5] → point droit-centre de la case
        //   right → origine [0, 0.5] → point gauche-centre de la case
        const ori  = obj.props.orientation || "up";
        const cx   = obj.col * CELL + CELL / 2;
        const cy   = obj.row * CELL + CELL / 2;
        const left = obj.col * CELL;
        const right= obj.col * CELL + CELL;
        const top  = obj.row * CELL;
        const bottom = obj.row * CELL + CELL;

        const anchor = {
          up:    { x: cx,    y: bottom },
          down:  { x: cx,    y: top },
          left:  { x: right, y: cy },
          right: { x: left,  y: cy },
        }[ori];

        level.spikes.push({
          x: anchor.x * GAME_SCALE,
          y: anchor.y * GAME_SCALE,
          orientation: ori
        });
      }

      if (obj.type === "redCircle") {
        level.redCircles.push({
          x: (obj.col * CELL + CELL / 2) * GAME_SCALE,
          y: (obj.row * CELL + CELL / 2) * GAME_SCALE,
          rise: obj.props.rise || 100,
          direction: obj.props.direction || "up"
        });
      }

      if (obj.type === "redSquare") {
        level.redSquares.push({
          x: (obj.col * CELL + CELL / 2) * GAME_SCALE,
          y: (obj.row * CELL + CELL / 2) * GAME_SCALE,
          rise: obj.props.rise || 100,
          direction: obj.props.direction || "right"
        });
      }
    }

    return level;
  }

  // ── Export JSON ───────────────────────────────────────
  _exportJSON() {
    const json = JSON.stringify(this._buildLevelJSON(), null, 2);

    // Afficher une popup avec le JSON
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setScrollFactor(0).setDepth(50).setInteractive();

    const box = this.add.rectangle(width / 2, height / 2, 560, 480, 0x111122)
      .setStrokeStyle(2, 0x00BFFF).setScrollFactor(0).setDepth(51);

    this.add.text(width / 2, height / 2 - 215, "JSON du niveau", {
      fontSize: "20px", color: "#00BFFF", fontStyle: "bold"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(52);

    // Afficher le JSON tronqué
    const preview = json.length > 1200 ? json.slice(0, 1200) + "\n…" : json;
    const jsonTxt = this.add.text(width / 2 - 260, height / 2 - 185, preview, {
      fontSize: "10px", color: "#ccffcc",
      wordWrap: { width: 520 }
    }).setScrollFactor(0).setDepth(52);

    // Bouton copier
    const copyBtn = this.add.text(width / 2 - 60, height / 2 + 205, "📋 Copier", {
      fontSize: "16px", color: "#ffffff",
      backgroundColor: "#007700", padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(52).setInteractive();

    copyBtn.on("pointerdown", () => {
      navigator.clipboard.writeText(json).then(() => {
        copyBtn.setText("✅ Copié !");
        this.time.delayedCall(1500, () => copyBtn.setText("📋 Copier"));
      }).catch(() => {
        // Fallback : sélection textarea
        const ta = document.createElement("textarea");
        ta.value = json;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        copyBtn.setText("✅ Copié !");
        this.time.delayedCall(1500, () => copyBtn.setText("📋 Copier"));
      });
    });

    const closeBtn = this.add.text(width / 2 + 60, height / 2 + 205, "✕ Fermer", {
      fontSize: "16px", color: "#ffffff",
      backgroundColor: "#660000", padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(52).setInteractive();

    const all = [overlay, box, jsonTxt, copyBtn, closeBtn,
      ...this.children.list.filter(c => c.depth === 52 && c !== jsonTxt && c !== copyBtn && c !== closeBtn)
    ];

    const close = () => {
      overlay.destroy(); box.destroy(); jsonTxt.destroy();
      copyBtn.destroy(); closeBtn.destroy();
      // fermer le texte titre aussi
      this.children.list
        .filter(c => c.depth === 52)
        .forEach(c => c.destroy());
    };
    closeBtn.on("pointerdown", close);
    overlay.on("pointerdown", close);
  }

  // ── Jouer le niveau ───────────────────────────────────
  _playLevel() {
    const level = this._buildLevelJSON();

    if (!this.playerPos) {
      this._toast("⚠ Placez d'abord le départ (P) !", "#FF4444");
      return;
    }
    if (!this.exitPos) {
      this._toast("⚠ Placez d'abord la sortie (O) !", "#FF4444");
      return;
    }

    // Ajouter les champs requis par LevelScene
    level.nextScene  = "LevelEditorScene";
    level.reward     = 0;

    // Mettre le JSON dans le cache Phaser
    this.cache.json.add("__editorLevel__", level);

    // Lancer LevelScene avec la clé spéciale
    this.scene.start("LevelScene", { levelKey: "__editorLevel__" });
  }

  // ── Import JSON ───────────────────────────────────────
  _openImportDialog() {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8)
      .setScrollFactor(0).setDepth(60).setInteractive();

    const box = this.add.rectangle(width / 2, height / 2, 500, 200, 0x111122)
      .setStrokeStyle(2, 0x00BFFF).setScrollFactor(0).setDepth(61);

    const title = this.add.text(width / 2, height / 2 - 80, "Coller le JSON ici :", {
      fontSize: "18px", color: "#00BFFF"
    }).setOrigin(0.5).setScrollFactor(0).setDepth(62);

    // Textarea HTML
    const ta = document.createElement("textarea");
    ta.style.cssText = `
      position:fixed; left:50%; top:50%;
      transform:translate(-50%,-25%);
      width:440px; height:80px;
      background:#111; color:#0f0; border:1px solid #00BFFF;
      font-size:11px; padding:6px; z-index:9999; resize:none;
    `;
    ta.placeholder = '{ "playerStart": { "x": 40, "y": 540 }, … }';
    document.body.appendChild(ta);
    ta.focus();

    const okBtn = this.add.text(width / 2 - 60, height / 2 + 70, "✅ Importer", {
      fontSize: "16px", color: "#ffffff",
      backgroundColor: "#007700", padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(62).setInteractive();

    const cancelBtn = this.add.text(width / 2 + 60, height / 2 + 70, "✕ Annuler", {
      fontSize: "16px", color: "#ffffff",
      backgroundColor: "#660000", padding: { x: 16, y: 8 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(62).setInteractive();

    const close = () => {
      document.body.removeChild(ta);
      overlay.destroy(); box.destroy(); title.destroy();
      okBtn.destroy(); cancelBtn.destroy();
    };

    okBtn.on("pointerdown", () => {
      try {
        const parsed = JSON.parse(ta.value.trim());
        close();
        this._clearAll();
        this._importLevel(parsed);
        this._saveToStorage();
      } catch(e) {
        ta.style.border = "2px solid red";
        ta.value = "❌ JSON invalide : " + e.message;
      }
    });

    cancelBtn.on("pointerdown", close);
    overlay.on("pointerdown", close);
  }

  // ── Importer un niveau dans l'éditeur ────────────────
  // Les coordonnées du JSON sont en base 40px (jeu) ; on les divise
  // par GAME_SCALE pour retrouver la grille fine de l'éditeur (20px).
  _importLevel(level) {
    // playerStart
    if (level.playerStart) {
      const col = Math.floor((level.playerStart.x / GAME_SCALE) / CELL);
      const row = Math.floor((level.playerStart.y / GAME_SCALE) / CELL);
      this.playerPos = { col, row };
      this._drawSpecial(col, row, 0xAA66CC, "P");
    }

    // blueCircle
    if (level.blueCircle) {
      const col = Math.floor((level.blueCircle.x / GAME_SCALE) / CELL);
      const row = Math.floor((level.blueCircle.y / GAME_SCALE) / CELL);
      this.exitPos = { col, row };
      this._drawSpecial(col, row, 0x0000FF, "O");
    }

    // platforms
    (level.platforms || []).forEach(p => {
      const px = p.x / GAME_SCALE, py = p.y / GAME_SCALE;
      const pw = p.w / GAME_SCALE, ph = (p.h || CELL * GAME_SCALE) / GAME_SCALE;
      const cols = Math.round(pw / CELL) || 1;
      const rows = Math.round(ph / CELL) || 1;
      for (let dc = 0; dc < cols; dc++) {
        for (let dr = 0; dr < rows; dr++) {
          const col = Math.floor(px / CELL) + dc;
          const row = Math.floor(py / CELL) + dr;
          if (col >= COLS || row >= ROWS) continue;
          const key = cellKey(col, row);
          if (!this.objects.has(key)) {
            const props = { color: typeof p.color === "number"
              ? "0x" + p.color.toString(16).toUpperCase().padStart(6,"0")
              : (p.color || "0xA0522D") };
            const gfx = this.add.graphics();
            this._renderObject(gfx, col, row, "platform", props);
            this.objects.set(key, { type: "platform", col, row, props, gfx });
          }
        }
      }
    });

    // icePlatforms
    (level.icePlatforms || []).forEach(p => {
      const px = p.x / GAME_SCALE, py = p.y / GAME_SCALE;
      const pw = p.w / GAME_SCALE, ph = (p.h || CELL * GAME_SCALE) / GAME_SCALE;
      const cols = Math.round(pw / CELL) || 1;
      const rows = Math.round(ph / CELL) || 1;
      for (let dc = 0; dc < cols; dc++) {
        for (let dr = 0; dr < rows; dr++) {
          const col = Math.floor(px / CELL) + dc;
          const row = Math.floor(py / CELL) + dr;
          if (col >= COLS || row >= ROWS) continue;
          const key = cellKey(col, row);
          if (!this.objects.has(key)) {
            const props = {};
            const gfx = this.add.graphics();
            this._renderObject(gfx, col, row, "ice", props);
            this.objects.set(key, { type: "ice", col, row, props, gfx });
          }
        }
      }
    });

    // spikes
    (level.spikes || []).forEach(s => {
      const sx = s.x / GAME_SCALE, sy = s.y / GAME_SCALE;
      const ori = s.orientation || "up";
      // Inverse exact de l'export : (sx, sy) est le point d'ancrage
      // de la case selon l'orientation (voir _buildLevelJSON).
      let col, row;
      if (ori === "up") {
        col = Math.floor(sx / CELL);
        row = Math.floor((sy - CELL) / CELL); // sy = bas de la case → remonter
      } else if (ori === "down") {
        col = Math.floor(sx / CELL);
        row = Math.floor(sy / CELL);           // sy = haut de la case
      } else if (ori === "left") {
        col = Math.floor(sx / CELL) - 1;       // sx = droite de la case → reculer
        row = Math.floor((sy - CELL / 2) / CELL);
      } else { // right
        col = Math.floor(sx / CELL);           // sx = gauche de la case
        row = Math.floor((sy - CELL / 2) / CELL);
      }
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
      const key = cellKey(col, row);
      const props = { orientation: ori };
      const gfx = this.add.graphics();
      this._renderObject(gfx, col, row, "spike", props);
      this.objects.set(key, { type: "spike", col, row, props, gfx });
    });

    // redCircles
    (level.redCircles || []).forEach(c => {
      const cx = c.x / GAME_SCALE, cy = c.y / GAME_SCALE;
      const col = Math.floor(cx / CELL);
      const row = Math.floor(cy / CELL);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
      const key = cellKey(col, row);
      const props = { rise: c.rise || 100, direction: c.direction || "up" };
      const gfx = this.add.graphics();
      this._renderObject(gfx, col, row, "redCircle", props);
      this.objects.set(key, { type: "redCircle", col, row, props, gfx });
    });

    // redSquares
    (level.redSquares || []).forEach(r => {
      const rx = r.x / GAME_SCALE, ry = r.y / GAME_SCALE;
      const col = Math.floor(rx / CELL);
      const row = Math.floor(ry / CELL);
      if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;
      const key = cellKey(col, row);
      const props = { rise: r.rise || 100, direction: r.direction || "right" };
      const gfx = this.add.graphics();
      this._renderObject(gfx, col, row, "redSquare", props);
      this.objects.set(key, { type: "redSquare", col, row, props, gfx });
    });
  }

  // ── Persistance localStorage ─────────────────────────
  _saveToStorage() {
    try {
      const json = JSON.stringify(this._buildLevelJSON());
      localStorage.setItem(LS_KEY, json);
    } catch(e) {
      console.warn("Impossible de sauvegarder dans localStorage :", e);
    }
  }

  _loadFromStorage() {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch(e) {
      console.warn("Impossible de lire depuis localStorage :", e);
      return null;
    }
  }

  // ── Toast notification ────────────────────────────────
  _toast(msg, color = "#ffffff") {
    const { width, height } = this.scale;
    const t = this.add.text(width / 2, height - 30, msg, {
      fontSize: "16px", color,
      backgroundColor: "#000000bb", padding: { x: 12, y: 6 }
    }).setOrigin(0.5).setScrollFactor(0).setDepth(80);
    this.tweens.add({
      targets: t, alpha: 0, duration: 2000, delay: 1000,
      onComplete: () => t.destroy()
    });
  }

  // ── Preload (requis pour le JSON du niveau joué) ──────
  preload() {
    // Rien à charger — le JSON est injecté en mémoire via cache
  }
}
