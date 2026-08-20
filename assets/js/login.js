(function () {
  "use strict";

  const REMEMBERED_EMAIL_KEY = "firstbite.rememberedEmail";

  function nextPage() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && /^[a-z0-9-]+\.html$/i.test(next) ? next : "index.html";
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const emailInput = document.querySelector("#login-email");
    const passwordInput = document.querySelector("#login-password");
    const rememberInput = document.querySelector("#remember-email");
    const submit = document.querySelector(".form-submit");
    const errorText = document.querySelector('[data-error-for="login-email"]');

    if (!emailInput || !passwordInput || !submit || !window.FirstBiteApi) return;

    const rememberedEmail = localStorage.getItem(REMEMBERED_EMAIL_KEY);
    if (rememberedEmail) {
      emailInput.value = rememberedEmail;
      if (rememberInput) rememberInput.checked = true;
    }

    const setError = (message = "") => {
      if (errorText) errorText.textContent = message;
    };

    const setBusy = (busy) => {
      submit.textContent = busy ? "로그인 중..." : "로그인";
      if (busy) submit.setAttribute("aria-disabled", "true");
      else submit.removeAttribute("aria-disabled");
      emailInput.disabled = busy;
      passwordInput.disabled = busy;
      if (rememberInput) rememberInput.disabled = busy;
    };

    const runLogin = async (event) => {
      event.preventDefault();
      if (submit.getAttribute("aria-disabled") === "true") return;

      const email = emailInput.value.trim().toLowerCase();
      const password = passwordInput.value;

      if (!email || !password) {
        setError("이메일과 비밀번호를 모두 입력해 주세요.");
        return;
      }
      if (!validEmail(email)) {
        setError("올바른 이메일 형식으로 입력해 주세요.");
        return;
      }
      if (password.length < 8 || password.length > 64) {
        setError("비밀번호는 8자 이상 64자 이하로 입력해 주세요.");
        return;
      }

      setError();
      setBusy(true);

      try {
        await window.FirstBiteApi.login(email, password);
        if (rememberInput && rememberInput.checked) localStorage.setItem(REMEMBERED_EMAIL_KEY, email);
        else localStorage.removeItem(REMEMBERED_EMAIL_KEY);
        window.location.assign(nextPage());
      } catch (error) {
        const messages = {
          COMMON_INVALID_REQUEST: "이메일과 비밀번호 입력값을 다시 확인해 주세요.",
          AUTH_INVALID_CREDENTIALS: "이메일 또는 비밀번호가 올바르지 않습니다.",
          AUTH_ACCOUNT_DISABLED: "사용할 수 없는 계정입니다.",
          AUTH_LOGIN_RATE_LIMITED: "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          COMMON_NETWORK_ERROR: "서버에 연결할 수 없습니다. 백엔드 실행 상태를 확인해 주세요."
        };
        setError(messages[error.code] || error.message);
      } finally {
        setBusy(false);
      }
    };

    submit.addEventListener("click", runLogin);
    [emailInput, passwordInput].forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") runLogin(event);
      });
      input.addEventListener("input", () => setError());
    });

    // 현재 백엔드에는 소셜 로그인 API가 없으므로 버튼이 잘못된 성공 흐름으로 이동하지 않게 막는다.
    document.querySelectorAll(".social-buttons button").forEach((button) => {
      button.addEventListener("click", () => {
        setError("현재 소셜 로그인은 백엔드 API가 준비되지 않아 사용할 수 없습니다.");
      });
    });
  });
})();
