// Android waitlist. Writes one document to Firestore through its REST API; the rules in
// tools/firebase/firestore.rules allow create only, so nobody can read the list from a browser.
// The document id is the SHA-256 of the lower-cased address: the same person signing up twice
// lands on the same id and Firestore refuses the second copy.
(function () {
  var form = document.querySelector("[data-waitlist]");
  if (!form) return;
  var status = form.querySelector("[data-status]");
  var button = form.querySelector('button[type="submit"]');
  var messages = JSON.parse(form.getAttribute("data-messages"));
  var openedAt = Date.now();
  var STORE_KEY = "ca-waitlist";

  function show(kind, text) {
    status.className = "form-status " + (kind || "");
    status.textContent = text;
  }

  try { if (localStorage.getItem(STORE_KEY)) show("ok", messages.already); } catch (e) {}

  async function sha256(text) {
    var bytes = new TextEncoder().encode(text);
    var digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map(function (b) { return b.toString(16).padStart(2, "0"); }).join("");
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    var email = form.email.value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254) { show("err", messages.invalid); form.email.focus(); return; }
    if (!form.consent.checked) { show("err", messages.need_consent); return; }
    // A filled honeypot or a submit within two seconds of the page opening is a bot: pretend it worked.
    if (form.company.value || Date.now() - openedAt < 2000) { show("ok", messages.ok); return; }

    button.disabled = true;
    show("", messages.sending);
    try {
      var id = await sha256(email);
      var project = form.getAttribute("data-project");
      var endpoint = "https://firestore.googleapis.com/v1/projects/" + project +
        "/databases/(default)/documents/waitlist?documentId=" + id + "&key=" + form.getAttribute("data-key");
      var params = new URLSearchParams(window.location.search);
      var source = (params.get("ref") || params.get("utm_source") || "site").slice(0, 40);
      var response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fields: {
          email: { stringValue: email },
          lang: { stringValue: form.getAttribute("data-lang") },
          platform: { stringValue: "android" },
          source: { stringValue: source }
        } })
      });
      if (response.ok) {
        show("ok", messages.ok);
        form.reset();
        try { localStorage.setItem(STORE_KEY, "1"); } catch (e) {}
      } else if (response.status === 409) {
        show("ok", messages.already);
        try { localStorage.setItem(STORE_KEY, "1"); } catch (e) {}
      } else {
        show("err", messages.error);
      }
    } catch (e) {
      show("err", messages.error);
    } finally {
      button.disabled = false;
    }
  });
})();
