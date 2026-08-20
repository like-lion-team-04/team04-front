(function () {
  "use strict";
  const api = window.FirstBiteAPI;
  const page = document.body.dataset.page;
  const errorText = (error) => error && error.message ? error.message : "요청을 처리하지 못했습니다.";
  const setBusy = (button, busy) => { button.setAttribute("aria-busy", String(busy)); button.classList.toggle("is-loading", busy); };

  // 소셜 로그인: 백엔드 OAuth2 authorize 엔드포인트로 전체 페이지 이동한다.
  // 백엔드 origin = API base에서 "/api/v1"를 제거한 값.
  const backendOrigin = (window.FIRSTBITE_API_BASE || "/api/v1").replace(/\/api\/v1\/?$/, "");
  document.querySelectorAll("[data-social]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const provider = btn.getAttribute("data-social");
      window.location.href = `${backendOrigin}/oauth2/authorization/${provider}`;
    });
  });

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
    // OCTOMO MO 방식: 서버가 문자를 보내지 않는다.
    // 사용자가 지정 문구를 대표번호로 직접 전송한 뒤, 서버가 수신 여부를 조회해 확인한다.
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
        // 문자 앱을 수신번호·본문이 채워진 상태로 연다.
        if (created.smsUri) window.open(created.smsUri, "_blank", "noopener");
        const guide = `아래 내용을 그대로 문자로 보내주세요.\n\n받는 번호: ${created.recipientNumber}\n보낼 내용: ${created.messageText}\n\n전송을 완료한 뒤 확인을 눌러 주세요.`;

        // 문자 수신 확인은 즉시 반영되지 않을 수 있으므로(PENDING) 사용자가 재시도할 수 있게 반복한다.
        while (true) {
          const sent = window.confirm(guide);
          if (!sent) { notice.textContent = "휴대폰 인증을 취소했습니다. 다시 진행해 주세요."; return; }
          const confirmed = await api.confirmPhoneVerification(created.requestId);
          if (confirmed && confirmed.status === "VERIFIED" && confirmed.verificationToken) {
            sessionStorage.setItem("firstbiteVerificationToken", confirmed.verificationToken);
            window.location.href = "signup-info.html";
            return;
          }
          // PENDING: 아직 문자가 확인되지 않음 → 안내 후 재시도 루프
          notice.textContent = "아직 문자가 확인되지 않았어요. 문자를 보낸 뒤 다시 확인해 주세요.";
        }
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
