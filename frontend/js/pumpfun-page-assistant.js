(function () {
  const STATE_KEY = "__GMJ_PUMPFUN_ASSISTANT__";
  if (window[STATE_KEY]?.mounted) {
    window[STATE_KEY].open?.();
    return;
  }

  const script = document.currentScript;
  const bridgeOrigin = (() => {
    try {
      return new URL(script?.src || "https://www.getmeajob.fun/js/pumpfun-page-assistant.js").origin;
    } catch {
      return "https://www.getmeajob.fun";
    }
  })();

  const state = {
    mounted: true,
    preparedId: String(window.__GMJ_PREPARED_ID || "").trim(),
    submission: null,
    root: null,
    status: null
  };
  window[STATE_KEY] = state;

  function text(value) {
    return String(value || "").trim();
  }

  function visible(el) {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function emitInput(el, value) {
    if (!el) return false;
    el.focus();
    const setter = Object.getOwnPropertyDescriptor(el.constructor.prototype, "value")?.set;
    if (setter) setter.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function clickCheckboxes() {
    const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]')).filter(visible);
    let count = 0;
    for (const box of boxes) {
      if (!box.checked) {
        box.click();
        count += 1;
      }
    }
    return count;
  }

  function findDescriptionBox() {
    const textareas = Array.from(document.querySelectorAll("textarea")).filter(visible);
    return (
      textareas.find((el) => /tell the sponsor|description|submission/i.test(el.placeholder || "")) ||
      textareas.sort((a, b) => b.getBoundingClientRect().height - a.getBoundingClientRect().height)[0] ||
      null
    );
  }

  function findLinksInput() {
    const inputs = Array.from(document.querySelectorAll("input")).filter(visible);
    return (
      inputs.find((el) => /github|drive|https|links?/i.test(`${el.placeholder || ""} ${el.name || ""}`)) ||
      inputs.find((el) => String(el.type || "").toLowerCase() === "url") ||
      null
    );
  }

  function submitButtons() {
    return Array.from(document.querySelectorAll("button"))
      .filter(visible)
      .filter((button) => /\bsubmit\b/i.test(button.textContent || ""));
  }

  function bodyWithLinks(submission) {
    const body = text(submission?.body);
    const links = Array.isArray(submission?.links) ? submission.links.map(text).filter(Boolean) : [];
    if (!links.length) return body;
    return `${body}\n\nLinks:\n${links.map((link) => `- ${link}`).join("\n")}`;
  }

  function setStatus(message, tone) {
    if (!state.status) return;
    state.status.textContent = message;
    state.status.dataset.tone = tone || "info";
  }

  function isPumpFunPage() {
    return /(^|\.)pump\.fun$/i.test(window.location.hostname);
  }

  async function copyPrepared() {
    const value = bodyWithLinks(state.submission);
    if (!value) return false;
    try {
      await navigator.clipboard.writeText(value);
      setStatus("Copied prepared submission.", "success");
      return true;
    } catch {
      setStatus("Could not copy automatically. Select the text in Get Me a Job if needed.", "error");
      return false;
    }
  }

  function fillPumpFunForm() {
    if (!state.submission) {
      setStatus("Load a prepared submission first.", "error");
      return;
    }
    if (!isPumpFunPage()) {
      setStatus("Open the real Pump.fun bounty page first, then click this assistant bookmark there.", "error");
      if (state.submission.sourceUrl) window.open(state.submission.sourceUrl, "_blank", "noopener,noreferrer");
      return;
    }
    const body = bodyWithLinks(state.submission);
    const checks = clickCheckboxes();
    const description = findDescriptionBox();
    const filledDescription = emitInput(description, body);
    const linkInput = findLinksInput();
    const firstLink = Array.isArray(state.submission.links) ? state.submission.links.map(text).find(Boolean) : "";
    const filledLink = firstLink ? emitInput(linkInput, firstLink) : false;

    const submits = submitButtons();
    for (const button of submits) {
      button.style.outline = "3px solid #66f2a8";
      button.style.boxShadow = "0 0 0 8px rgba(102,242,168,.18)";
      button.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const parts = [];
    parts.push(`${checks} checkbox${checks === 1 ? "" : "es"} checked`);
    parts.push(filledDescription ? "description filled" : "description box not found");
    if (firstLink) parts.push(filledLink ? "link filled" : "link box not found; links added to description");
    parts.push(submits.length ? "review, then click Pump.fun Submit" : "Pump.fun Submit button not visible yet");
    setStatus(parts.join(". "), filledDescription ? "success" : "error");
  }

  async function loadPrepared() {
    const id = state.preparedId || window.prompt("Paste the Get Me a Job prepared submission ID");
    state.preparedId = text(id);
    if (!state.preparedId) {
      setStatus("No prepared submission ID provided.", "error");
      return;
    }
    setStatus("Loading prepared Get Me a Job submission...");
    const res = await fetch(`${bridgeOrigin}/api/pumpfun/prepared/${encodeURIComponent(state.preparedId)}`, {
      headers: { Accept: "application/json" },
      cache: "no-store"
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || `Could not load prepared submission (${res.status})`);
    state.submission = payload.submission;
    renderLoaded();
    if (isPumpFunPage()) {
      setStatus("Ready. Open Pump.fun's submit modal, then fill the form.", "success");
    } else {
      setStatus("Loaded here for preview. Open Pump.fun, then click the assistant bookmark there.", "error");
    }
  }

  function renderLoaded() {
    const title = state.root.querySelector("[data-gmj-title]");
    const body = state.root.querySelector("[data-gmj-body]");
    const meta = state.root.querySelector("[data-gmj-meta]");
    if (title) title.textContent = state.submission?.title || "Prepared bounty submission";
    if (meta) {
      const links = Array.isArray(state.submission?.links) ? state.submission.links.length : 0;
      meta.textContent = `${state.submission?.agentName || "Get Me a Job Agent"} - ${links} link${links === 1 ? "" : "s"}`;
    }
    if (body) body.value = bodyWithLinks(state.submission);
  }

  function mount() {
    const root = document.createElement("section");
    root.id = "gmj-pumpfun-assistant";
    root.innerHTML = `
      <style>
        #gmj-pumpfun-assistant {
          position: fixed;
          right: 18px;
          bottom: 18px;
          z-index: 2147483647;
          width: min(420px, calc(100vw - 24px));
          color: #f7fff9;
          font: 14px/1.4 Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }
        #gmj-pumpfun-assistant .gmj-card {
          border: 1px solid rgba(102,242,168,.45);
          border-radius: 16px;
          background: linear-gradient(180deg, rgba(22,24,27,.98), rgba(10,12,13,.98));
          box-shadow: 0 22px 70px rgba(0,0,0,.46), 0 0 0 1px rgba(255,255,255,.04) inset;
          overflow: hidden;
        }
        #gmj-pumpfun-assistant header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 10px;
          padding: 14px 16px 10px;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        #gmj-pumpfun-assistant h2,
        #gmj-pumpfun-assistant p {
          margin: 0;
        }
        #gmj-pumpfun-assistant h2 {
          font-size: 16px;
        }
        #gmj-pumpfun-assistant small {
          color: #b5c7bd;
          font-size: 12px;
        }
        #gmj-pumpfun-assistant button {
          border: 1px solid rgba(102,242,168,.35);
          border-radius: 10px;
          background: rgba(255,255,255,.06);
          color: #f7fff9;
          cursor: pointer;
          font-weight: 800;
          padding: 10px 12px;
        }
        #gmj-pumpfun-assistant button.primary {
          background: #66f2a8;
          color: #08110d;
          border-color: #66f2a8;
        }
        #gmj-pumpfun-assistant button.icon {
          width: 34px;
          height: 34px;
          padding: 0;
        }
        #gmj-pumpfun-assistant .gmj-body {
          display: grid;
          gap: 10px;
          padding: 14px 16px 16px;
        }
        #gmj-pumpfun-assistant textarea {
          min-height: 120px;
          resize: vertical;
          border: 1px solid rgba(255,255,255,.12);
          border-radius: 12px;
          background: rgba(0,0,0,.35);
          color: #eaf7ef;
          padding: 10px;
          font: inherit;
        }
        #gmj-pumpfun-assistant .gmj-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
        }
        #gmj-pumpfun-assistant [data-gmj-status] {
          min-height: 18px;
          color: #d2ded8;
          font-size: 12px;
        }
        #gmj-pumpfun-assistant [data-gmj-status][data-tone="success"] {
          color: #66f2a8;
        }
        #gmj-pumpfun-assistant [data-gmj-status][data-tone="error"] {
          color: #ff7777;
        }
      </style>
      <div class="gmj-card">
        <header>
          <div>
            <h2>Get Me a Job Agent</h2>
            <small data-gmj-meta>Preparing Pump.fun submission</small>
          </div>
          <button class="icon" type="button" data-gmj-close aria-label="Close">x</button>
        </header>
        <div class="gmj-body">
          <div>
            <strong data-gmj-title>Prepared bounty submission</strong>
            <p><small data-gmj-instructions>Open Pump.fun's submit modal first. This fills the form; you review and click Pump.fun Submit.</small></p>
          </div>
          <textarea data-gmj-body readonly placeholder="Prepared submission will appear here."></textarea>
          <div class="gmj-actions">
            <button class="primary" type="button" data-gmj-fill>Fill Pump.fun form</button>
            <button type="button" data-gmj-copy>Copy text</button>
          </div>
          <div data-gmj-status role="status"></div>
        </div>
      </div>
    `;
    document.documentElement.appendChild(root);
    state.root = root;
    state.status = root.querySelector("[data-gmj-status]");
    const instructions = root.querySelector("[data-gmj-instructions]");
    if (instructions && !isPumpFunPage()) {
      instructions.textContent = "This is only a preview here. Open Pump.fun, open the submit modal, then click the assistant bookmark there.";
    }
    state.open = () => {
      root.style.display = "block";
      loadPrepared().catch((error) => setStatus(error.message || "Could not load prepared submission", "error"));
    };
    root.querySelector("[data-gmj-close]")?.addEventListener("click", () => {
      root.style.display = "none";
    });
    root.querySelector("[data-gmj-fill]")?.addEventListener("click", fillPumpFunForm);
    root.querySelector("[data-gmj-copy]")?.addEventListener("click", copyPrepared);
    state.open();
  }

  mount();
})();
