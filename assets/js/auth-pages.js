(function () {
  "use strict";
  const api = window.FirstBiteAPI;
  const page = document.body.dataset.page;
  const errorText = (error) => error && error.message ? error.message : "요청을 처리하지 못했습니다.";
  const setBusy = (button, busy) => { button.setAttribute("aria-busy", String(busy)); button.classList.toggle("is-loading", busy); };

  if (page === "login") {
    const button = document.querySelector(".form-submit");
    const email = document.querySelector("#login-email");
    const password = document.querySelector("#login-password");
    const remember = document.querySelector("#remember-email");
    const error = document.querySelector('[data-error-for="login-email"]');
    const remembered = localStorage.getItem("firstbiteRememberedEmail");
    if (remembered) { email.value = remembered; remember.checked = true; }
    button.addEventListener("click", async (event) => {
      event.preventDefault(); error.textContent = "";
      if (!email.value.trim() || !password.value) { error.textContent = "이메일과 비밀번호를 입력해 주세요."; return; }
      setBusy(button, true);
      try {
        await api.login(email.value.trim(), password.value);
        remember.checked ? localStorage.setItem("firstbiteRememberedEmail", email.value.trim()) : localStorage.removeItem("firstbiteRememberedEmail");
        window.location.href = "index.html";
      } catch (requestError) { error.textContent = errorText(requestError); }
      finally { setBusy(button, false); }
    });
  }

  if (page === "signup-verify") {
    const card = document.querySelector(".verification-card");
    const notice = document.querySelector(".signup-notice");
    card.addEventListener("click", async (event) => {
      event.preventDefault();
      const phoneNumber = window.prompt("휴대폰 번호 11자리를 입력해 주세요. ('-' 제외)");
      if (phoneNumber === null) return;
      if (!/^01\d{8,9}$/.test(phoneNumber)) { notice.textContent = "휴대폰 번호를 숫자만 정확히 입력해 주세요."; return; }
      setBusy(card, true);
      try {
        const created = await api.createPhoneVerification(phoneNumber);
        sessionStorage.setItem("firstbitePhoneNumber", phoneNumber);
        if (created.requestId) sessionStorage.setItem("firstbiteVerificationRequestId", created.requestId);
        if (created.smsUri) window.open(created.smsUri, "_blank", "noopener");
        const code = window.prompt("문자로 받은 인증번호 6자리를 입력해 주세요.");
        if (code === null) { notice.textContent = "인증번호 입력을 취소했습니다. 휴대폰 인증을 다시 진행해 주세요."; return; }
        if (!/^\d{6}$/.test(code)) throw new Error("인증번호는 6자리 숫자로 입력해 주세요.");
        const confirmed = await api.confirmPhoneVerification({ phoneNumber, code });
        if (!confirmed.verificationToken) throw new Error("휴대폰 인증 결과를 확인하지 못했습니다.");
        sessionStorage.setItem("firstbiteVerificationToken", confirmed.verificationToken);
        window.location.href = "signup-info.html";
      } catch (requestError) { notice.textContent = errorText(requestError); }
      finally { setBusy(card, false); }
    });
  }

  if (page === "signup-info") {
    const button = document.querySelector(".form-submit");
    const phone = document.querySelector("#phone-number");
    const agreementError = document.querySelector('[data-error-for="agreements"]');
    phone.value = sessionStorage.getItem("firstbitePhoneNumber") || "";
    phone.readOnly = Boolean(phone.value);
    document.querySelector("#agree-all").addEventListener("change", (event) => {
      document.querySelectorAll(".agreement-section input[type=checkbox]").forEach((input) => { input.checked = event.target.checked; });
    });
    button.addEventListener("click", async (event) => {
      event.preventDefault(); agreementError.textContent = "";
      const token = sessionStorage.getItem("firstbiteVerificationToken");
      const name = document.querySelector("#name").value.trim();
      const email = document.querySelector("#signup-email").value.trim();
      const password = document.querySelector("#signup-password").value;
      const confirm = document.querySelector("#signup-password-confirm").value;
      const birthDate = document.querySelector("#birth-date").value.trim();
      const termsAgreed = document.querySelector("#terms-agreed").checked;
      const privacyAgreed = document.querySelector("#privacy-agreed").checked;
      if (!token) { agreementError.textContent = "먼저 휴대폰 본인인증을 완료해 주세요."; return; }
      if (!name || !email || !password || !birthDate) { agreementError.textContent = "필수 정보를 모두 입력해 주세요."; return; }
      if (password !== confirm) { agreementError.textContent = "비밀번호가 서로 일치하지 않습니다."; return; }
      if (!termsAgreed || !privacyAgreed) { agreementError.textContent = "필수 약관에 동의해 주세요."; return; }
      setBusy(button, true);
      try {
        await api.signup({ verificationToken: token, name, email, password, birthDate, termsAgreed, privacyAgreed, marketingAgreed: document.querySelector("#marketing-agreed").checked });
        sessionStorage.removeItem("firstbiteVerificationToken");
        window.location.href = "signup-complete.html";
      } catch (requestError) { agreementError.textContent = errorText(requestError); }
      finally { setBusy(button, false); }
    });
  }

  if (page === "account") {
    api.ensureSession().then(() => api.getMe()).then((me) => {
      document.querySelectorAll('[data-account-field="name"]').forEach((el) => { el.textContent = me.name || ""; });
      document.querySelectorAll('[data-account-field="email"]').forEach((el) => { el.textContent = me.email || ""; });
    }).catch(() => {});
  }
})();
