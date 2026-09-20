// =========================================================
//               MOBILE — DÉTECTION & OUTILS
// =========================================================
// - isMobile()        : true sur téléphone / tablette (écran tactile
//                       en pointeur principal). Les boutons tactiles
//                       ne s'affichent que dans ce cas.
// - setupMobile()     : réglages de page (viewport, anti-zoom, anti-scroll,
//                       message "tourne ton téléphone").
// - createTextForm()  : champs de texte. Sur PC : saisie clavier comme avant.
//                       Sur mobile : vrais <input> HTML posés par-dessus les
//                       champs dessinés dans Phaser, ce qui fait apparaître
//                       le clavier du téléphone.
//
// 💡 Pour tester sur PC : ajouter ?mobile=1 à l'URL (et ?mobile=0 pour
//    forcer le mode PC sur un téléphone).
// =========================================================

let _isMobile = null;

export function isMobile() {
  if (_isMobile !== null) return _isMobile;

  const forced = new URLSearchParams(window.location.search).get("mobile");
  if (forced === "1") return (_isMobile = true);
  if (forced === "0") return (_isMobile = false);

  const hasTouch = navigator.maxTouchPoints > 0 || "ontouchstart" in window;
  // "pointer: coarse" = le pointeur principal est un doigt. Un PC portable
  // avec écran tactile garde une souris/trackpad → "fine" → pas de boutons.
  const coarse   = window.matchMedia?.("(pointer: coarse)").matches ?? false;
  const uaMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  // iPadOS se fait passer pour un Mac dans son user-agent
  const iPadOS   = navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;

  _isMobile = hasTouch && (coarse || uaMobile || iPadOS);
  return _isMobile;
}

// =========================================================
//  RÉGLAGES DE LA PAGE (à appeler une fois, avant new Phaser.Game)
// =========================================================
export function setupMobile() {
  if (!isMobile()) return;

  // ── Viewport : pas de zoom, plein écran (encoche comprise).
  //    "interactive-widget=resizes-visual" : quand le clavier s'ouvre,
  //    Chrome Android ne redimensionne pas la page (sinon Phaser
  //    rétrécirait tout le jeu pendant la saisie). ──
  let meta = document.querySelector('meta[name="viewport"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "viewport";
    document.head.appendChild(meta);
  }
  meta.content =
    "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, " +
    "viewport-fit=cover, interactive-widget=resizes-visual";

  // ── CSS ──
  const style = document.createElement("style");
  style.textContent = `
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100%;
      overflow: hidden; overscroll-behavior: none;
    }
    canvas {
      touch-action: none;
      -webkit-touch-callout: none;
      -webkit-user-select: none; user-select: none;
      -webkit-tap-highlight-color: transparent;
      outline: none;
    }
    #jumpix-rotate {
      display: none; position: fixed; inset: 0; z-index: 100000;
      flex-direction: column; align-items: center; justify-content: center; gap: 14px;
      background: #0a0a1a; color: #fff; text-align: center; padding: 24px;
      font: 600 20px/1.4 sans-serif;
    }
    #jumpix-rotate .icon { font-size: 64px; animation: jumpix-rotate 2.2s ease-in-out infinite; }
    @keyframes jumpix-rotate {
      0%, 20%   { transform: rotate(0deg); }
      60%, 100% { transform: rotate(-90deg); }
    }
    /* Téléphone en portrait uniquement (une tablette en portrait reste jouable) */
    @media (orientation: portrait) and (max-aspect-ratio: 7/10) {
      #jumpix-rotate { display: flex; }
    }
  `;
  document.head.appendChild(style);

  // ── Message "tourne ton téléphone" ──
  const addRotateHint = () => {
    if (document.getElementById("jumpix-rotate")) return;
    const el = document.createElement("div");
    el.id = "jumpix-rotate";
    el.innerHTML = '<div class="icon">📱</div><div>Rotate your device<br>to play in landscape</div>';
    document.body.appendChild(el);
  };
  if (document.body) addRotateHint();
  else document.addEventListener("DOMContentLoaded", addRotateHint);

  // ── Pas de zoom au pincement (iOS) ni de menu contextuel au appui long ──
  ["gesturestart", "gesturechange", "gestureend"].forEach(type =>
    document.addEventListener(type, e => e.preventDefault(), { passive: false })
  );
  document.addEventListener("contextmenu", e => {
    if (e.target?.tagName !== "INPUT") e.preventDefault();
  });
}

// =========================================================
//  CHAMPS DE TEXTE
// =========================================================
// createTextForm(scene, fields, options)
//
// fields  : [{ id, box, text, value?, password?, maxLength?,
//              type?, autocomplete?, label? }]
//   - box  : le rectangle Phaser qui sert de cadre au champ
//   - text : l'objet Text Phaser qui affiche la valeur
// options : { onSubmit, onCancel, onChange(id, value),
//             highlight = true, initialFocus }
//
// Retourne { native, get(id), set(id, v), focus(id),
//            suspend(), resume(), destroy() }
//
// Sur PC, la saisie passe par les événements clavier de Phaser
// (comportement historique : Tab change de champ, Entrée valide,
// Échap annule). Sur mobile, chaque champ devient un vrai <input>
// aligné sur son cadre : un appui dessus ouvre le clavier du
// téléphone. La touche "Suivant" du clavier passe au champ d'après,
// "OK" sur le dernier valide le formulaire.
// =========================================================
export function createTextForm(scene, fieldDefs, options = {}) {
  const { onSubmit, onCancel, onChange, highlight = true, initialFocus } = options;
  const native = isMobile();

  const fields = fieldDefs.map(def => ({ ...def, value: def.value ?? "", el: null }));
  const byId   = Object.fromEntries(fields.map(f => [f.id, f]));
  let activeId   = byId[initialFocus] ? initialFocus : fields[0].id;
  let destroyed  = false;
  let suspended  = false;

  const render = f => {
    f.text.setText(f.password ? "•".repeat(f.value.length) : f.value);
  };

  // ── Surbrillance du champ actif ──
  const paint = () => {
    if (!highlight) return;
    fields.forEach(f => {
      const on = native ? document.activeElement === f.el : f.id === activeId;
      f.box.setStrokeStyle(on ? 2 : 1, on ? 0x00BFFF : 0x555555);
      if (f.el) f.el.style.border = `${on ? 2 : 1}px solid ${on ? "#00BFFF" : "#555555"}`;
    });
  };

  const submit = () => { if (!suspended) onSubmit?.(); };

  // ───────────────────────────────────────────────────────
  //  MODE MOBILE : <input> HTML posés sur les cadres Phaser
  // ───────────────────────────────────────────────────────
  let reposition = () => {};
  let onPointerDown = null;
  let onWinResize   = null;

  if (native) {
    reposition = () => {
      const canvas = scene.game?.canvas;
      if (!canvas) return;
      const r  = canvas.getBoundingClientRect();
      const sx = r.width  / scene.scale.width;
      const sy = r.height / scene.scale.height;

      fields.forEach(f => {
        if (!f.el) return;
        const b = f.box.getBounds();
        Object.assign(f.el.style, {
          left:   `${r.left + b.x * sx}px`,
          top:    `${r.top  + b.y * sy}px`,
          width:  `${b.width  * sx}px`,
          height: `${b.height * sy}px`,
          // ≥ 16px obligatoire : en dessous, iOS zoome la page au focus
          fontSize: `${Math.max(16, (parseFloat(f.text.style.fontSize) || 18) * sy)}px`
        });
      });
    };

    fields.forEach((f, i) => {
      const el = document.createElement("input");
      el.type = f.password ? "password" : (f.type || "text");
      el.value = f.value;
      if (f.maxLength) el.maxLength = f.maxLength;
      el.autocomplete = f.autocomplete || "off";
      el.spellcheck = false;
      el.setAttribute("autocapitalize", "none");
      el.setAttribute("autocorrect", "off");
      el.setAttribute("enterkeyhint", i === fields.length - 1 ? "go" : "next");
      if (f.label) el.setAttribute("aria-label", f.label);

      Object.assign(el.style, {
        position: "fixed", zIndex: "10000", boxSizing: "border-box", margin: "0",
        padding: "0 10px", background: "#000", color: "#fff", caretColor: "#00BFFF",
        border: highlight ? "1px solid #555555" : "2px solid #00BFFF",
        borderRadius: "0", outline: "none",
        fontFamily: "Courier, monospace",
        WebkitAppearance: "none", appearance: "none",
        touchAction: "manipulation",
        WebkitUserSelect: "text", userSelect: "text"
      });

      // Ces événements ne doivent pas remonter à Phaser (sa gestion des
      // touches peut bloquer certains caractères, ex. espace).
      el.addEventListener("keydown", e => {
        e.stopPropagation();
        if (e.key === "Enter") {
          e.preventDefault();
          if (i < fields.length - 1) {
            fields[i + 1].el.focus();
          } else {
            el.blur();          // referme le clavier
            submit();
          }
        } else if (e.key === "Escape") {
          onCancel?.();
        }
      });
      el.addEventListener("keyup", e => e.stopPropagation());

      el.addEventListener("input", () => {
        f.value = el.value;
        render(f);
        onChange?.(f.id, f.value);
      });
      el.addEventListener("focus", () => { activeId = f.id; paint(); reposition(); });
      el.addEventListener("blur", paint);

      // Les <input> remplacent l'affichage Phaser (vrai curseur, sélection,
      // correcteur, etc.) → on masque le texte Phaser correspondant.
      f.text.setVisible(false);

      document.body.appendChild(el);
      f.el = el;
    });

    // Appui ailleurs dans le jeu → on ferme le clavier
    onPointerDown = () => {
      const active = document.activeElement;
      if (fields.some(f => f.el === active)) active.blur();
    };
    scene.input.on("pointerdown", onPointerDown);

    // Le canvas peut changer de taille / de position (rotation, barre
    // d'adresse qui se rétracte…) → on recale les <input>.
    scene.scale.on("resize", reposition);
    onWinResize = () => { reposition(); setTimeout(reposition, 300); };
    window.addEventListener("resize", onWinResize);
    window.addEventListener("orientationchange", onWinResize);
    window.addEventListener("scroll", reposition);

    reposition();
    paint();
  }

  // ───────────────────────────────────────────────────────
  //  MODE PC : clavier physique via Phaser (comportement d'origine)
  // ───────────────────────────────────────────────────────
  let onKey = null;

  if (!native) {
    fields.forEach(f => {
      if (!f.box.input) f.box.setInteractive();
      f.box.on("pointerdown", () => { if (!suspended) { activeId = f.id; paint(); } });
    });

    onKey = e => {
      if (suspended || destroyed) return;

      if (e.key === "Tab" && fields.length > 1) {
        const i = fields.findIndex(f => f.id === activeId);
        activeId = fields[(i + 1) % fields.length].id;
        paint();
        e.preventDefault?.();
        return;
      }
      if (e.key === "Escape") { onCancel?.(); return; }
      if (e.key === "Enter")  { submit(); return; }

      const f = byId[activeId];
      if (e.key === "Backspace") {
        f.value = f.value.slice(0, -1);
      } else if (e.key.length === 1 && (!f.maxLength || f.value.length < f.maxLength)) {
        f.value += e.key;
      } else {
        return;
      }
      render(f);
      onChange?.(f.id, f.value);
    };
    scene.input.keyboard.on("keydown", onKey);
    paint();
  }

  fields.forEach(render);

  // ───────────────────────────────────────────────────────
  //  API
  // ───────────────────────────────────────────────────────
  const form = {
    native,

    get: id => byId[id].value,

    set(id, value) {
      const f = byId[id];
      f.value = value;
      if (f.el) f.el.value = value;
      render(f);
    },

    focus(id) {
      activeId = id;
      if (native) byId[id].el?.focus();
      else paint();
    },

    // Met le formulaire en pause (ex. une autre popup s'ouvre par-dessus) :
    // plus de saisie, et les <input> HTML sont cachés.
    suspend() {
      suspended = true;
      fields.forEach(f => {
        if (f.el) { f.el.blur(); f.el.style.display = "none"; }
      });
    },
    resume() {
      suspended = false;
      fields.forEach(f => { if (f.el) f.el.style.display = ""; });
      reposition();
    },

    destroy() {
      if (destroyed) return;
      destroyed = true;
      scene.events.off("shutdown", form.destroy);
      if (onKey)         scene.input.keyboard?.off("keydown", onKey);
      if (onPointerDown) scene.input?.off("pointerdown", onPointerDown);
      if (native) {
        scene.scale?.off("resize", reposition);
        window.removeEventListener("resize", onWinResize);
        window.removeEventListener("orientationchange", onWinResize);
        window.removeEventListener("scroll", reposition);
      }
      fields.forEach(f => f.el?.remove());
    }
  };

  // Si la scène change (ex. connexion réussie → MenuScene), on nettoie
  // les <input> HTML, sinon ils resteraient à l'écran.
  scene.events.once("shutdown", form.destroy);

  return form;
}
