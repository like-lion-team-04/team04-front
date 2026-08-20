(function () {
  "use strict";

  const REQUEST_KEY = "firstbite.phoneVerificationRequest";
  const TOKEN_KEY = "firstbite.verificationToken";

  function readVerification() {
    try {
      const value = JSON.parse(sessionStorage.getItem(TOKEN_KEY));
      if (!value || !value.token || !value.phoneNumber || value.expiresAt <= Date.now()) {
        sessionStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return value;
    } catch (_error) {
      sessionStorage.removeItem(TOKEN_KEY);
      return null;
    }
  }

  function toBirthDate(value) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!/^\d{8}$/.test(digits)) return null;
    const parsed = new Date(`${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    const normalized = `${year}-${month}-${day}`;
    return normalized === `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}` ? normalized : null;
  }

  function isAtLeastFourteen(birthDate) {
    const birth = new Date(`${birthDate}T00:00:00`);
    const today = new Date();
    const threshold = new Date(today.getFullYear() - 14, today.getMonth(), today.getDate());
    return birth <= threshold;
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
  }

  function validPassword(value) {
    if (value.length < 8 || value.length > 64 || /\s/.test(value)) return false;
    let categories = 0;
    if (/[A-Za-z]/.test(value)) categories += 1;
    if (/[0-9]/.test(value)) categories += 1;
    if (/[^A-Za-z0-9\s]/.test(value)) categories += 1;
    return categories >= 2;
  }

  function signupMessage(error) {
    const messages = {
      AUTH_EMAIL_DUPLICATED: "이미 사용 중인 이메일입니다. 다른 이메일을 입력해 주세요.",
      AUTH_PHONE_NUMBER_DUPLICATED: "이미 가입된 휴대폰 번호입니다. 로그인해 주세요.",
      PHONE_VERIFICATION_TOKEN_INVALID: "휴대폰 인증 정보가 올바르지 않습니다. 다시 인증해 주세요.",
      PHONE_VERIFICATION_TOKEN_USED: "이미 사용된 휴대폰 인증입니다. 다시 인증해 주세요.",
      PHONE_VERIFICATION_TOKEN_EXPIRED: "휴대폰 인증 시간이 만료되었습니다. 다시 인증해 주세요.",
      AUTH_PASSWORD_POLICY_VIOLATION: "비밀번호는 8~64자이며 영문·숫자·특수문자 중 2가지 이상을 조합하고 공백 없이 입력해 주세요.",
      AUTH_BIRTH_DATE_INVALID: "만 14세 이상만 가입할 수 있습니다. 생년월일을 확인해 주세요.",
      AUTH_REQUIRED_TERMS_NOT_AGREED: "필수 약관에 동의해 주세요.",
      COMMON_NETWORK_ERROR: "서버에 연결할 수 없습니다. 백엔드 실행 상태를 확인해 주세요."
    };
    const detail = Array.isArray(error.details) && error.details[0];
    return detail && detail.message ? detail.message : (messages[error.code] || error.message);
  }

  document.addEventListener("DOMContentLoaded", () => {
    const verification = readVerification();
    const nameInput = document.querySelector("#name");
    const emailInput = document.querySelector("#signup-email");
    const passwordInput = document.querySelector("#signup-password");
    const confirmInput = document.querySelector("#signup-password-confirm");
    const birthInput = document.querySelector("#birth-date");
    const phoneInput = document.querySelector("#phone-number");
    const agreeAll = document.querySelector("#agree-all");
    const termsInput = document.querySelector("#terms-agreed");
    const privacyInput = document.querySelector("#privacy-agreed");
    const marketingInput = document.querySelector("#marketing-agreed");
    const errorText = document.querySelector('[data-error-for="agreements"]');
    const submit = document.querySelector(".form-submit");

    if (!submit || !window.FirstBiteApi) return;

    if (!verification) {
      window.location.replace("signup-verify.html");
      return;
    }

    if (phoneInput) {
      phoneInput.value = verification.phoneNumber;
      phoneInput.readOnly = true;
    }

    const agreementInputs = [termsInput, privacyInput, marketingInput].filter(Boolean);
    if (agreeAll) {
      agreeAll.addEventListener("change", () => {
        agreementInputs.forEach((input) => { input.checked = agreeAll.checked; });
      });
    }
    agreementInputs.forEach((input) => {
      input.addEventListener("change", () => {
        if (agreeAll) agreeAll.checked = agreementInputs.every((item) => item.checked);
      });
    });

    const setError = (message = "") => {
      if (errorText) errorText.textContent = message;
    };

    // 준비 중 버튼(약관 보기)이 아무 반응 없이 침묵하지 않도록 안내한다.
    document.querySelectorAll("[data-coming-soon]").forEach((element) => {
      element.addEventListener("click", (event) => {
        event.preventDefault();
        window.alert("약관 전문은 준비 중입니다.");
      });
    });

    const setBusy = (busy) => {
      submit.textContent = busy ? "가입 중..." : "작성 완료";
      if (busy) submit.setAttribute("aria-disabled", "true");
      else submit.removeAttribute("aria-disabled");
    };

    submit.addEventListener("click", async (event) => {
      event.preventDefault();
      if (submit.getAttribute("aria-disabled") === "true") return;

      const currentVerification = readVerification();
      const name = nameInput ? nameInput.value.trim() : "";
      const email = emailInput ? emailInput.value.trim().toLowerCase() : "";
      const password = passwordInput ? passwordInput.value : "";
      const confirmPassword = confirmInput ? confirmInput.value : "";
      const birthDate = toBirthDate(birthInput ? birthInput.value : "");
      let message = "";

      if (!currentVerification) message = "휴대폰 인증이 만료되었습니다. 다시 인증해 주세요.";
      else if (!name || !email || !password) message = "필수 정보를 모두 입력해 주세요.";
      else if (name.length > 50) message = "이름은 50자 이하로 입력해 주세요.";
      else if (!validEmail(email)) message = "올바른 이메일 형식으로 입력해 주세요.";
      else if (!validPassword(password)) message = "비밀번호는 8~64자이며 영문·숫자·특수문자 중 2가지 이상을 조합해 주세요.";
      else if (password !== confirmPassword) message = "비밀번호 확인이 일치하지 않습니다.";
      else if (!birthDate) message = "생년월일을 YYYYMMDD 형식으로 정확히 입력해 주세요.";
      else if (!isAtLeastFourteen(birthDate)) message = "만 14세 이상만 가입할 수 있습니다.";
      else if (!termsInput || !termsInput.checked || !privacyInput || !privacyInput.checked) message = "필수 약관에 동의해 주세요.";

      if (message) {
        setError(message);
        return;
      }

      setError();
      setBusy(true);

      try {
        const result = await window.FirstBiteApi.signup({
          verificationToken: currentVerification.token,
          name,
          email,
          password,
          birthDate,
          termsAgreed: termsInput.checked,
          privacyAgreed: privacyInput.checked,
          marketingAgreed: Boolean(marketingInput && marketingInput.checked)
        });
        sessionStorage.setItem("firstbite.signupResult", JSON.stringify(result));
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(REQUEST_KEY);
        window.location.assign("signup-complete.html");
      } catch (error) {
        if (["PHONE_VERIFICATION_TOKEN_INVALID", "PHONE_VERIFICATION_TOKEN_USED", "PHONE_VERIFICATION_TOKEN_EXPIRED"].includes(error.code)) {
          sessionStorage.removeItem(TOKEN_KEY);
          sessionStorage.removeItem(REQUEST_KEY);
        }
        setError(signupMessage(error));
      } finally {
        setBusy(false);
      }
    });
  });
})();
