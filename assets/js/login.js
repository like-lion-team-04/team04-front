(function () {
  "use strict";

  const REMEMBERED_EMAIL_KEY = "firstbite.rememberedEmail";
  const SOCIAL_PROVIDER_LABELS = {
    kakao: "카카오",
    google: "구글",
    naver: "네이버",
    apple: "Apple"
  };
  const SUPPORTED_SOCIAL_PROVIDERS = new Set(["kakao", "google"]);

  function nextPage() {
    const next = new URLSearchParams(window.location.search).get("next");
    return next && /^[a-z0-9-]+\.html$/i.test(next) ? next : "index.html";
  }

  function validEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
  }

  function oauthErrorMessage(code) {
    const messages = {
      failed: "소셜 로그인에 실패했습니다. 다시 시도해 주세요.",
      cancelled: "소셜 로그인이 취소되었습니다.",
      session: "소셜 로그인 세션을 확인하지 못했습니다. 다시 로그인해 주세요."
    };
    return messages[code] || "소셜 로그인을 완료하지 못했습니다. 다시 시도해 주세요.";
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

    const oauthError = new URLSearchParams(window.location.search).get("oauth_error");
    if (oauthError) {
      window.FirstBiteApi.clearPendingSocialLogin();
      setError(oauthErrorMessage(oauthError));
      const url = new URL(window.location.href);
      url.searchParams.delete("oauth_error");
      window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
    }

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

    document.querySelectorAll("[data-social-provider]").forEach((button) => {
      button.addEventListener("click", () => {
        const provider = String(button.dataset.socialProvider || "").toLowerCase();
        const label = SOCIAL_PROVIDER_LABELS[provider] || "소셜";
        setError();

        if (!SUPPORTED_SOCIAL_PROVIDERS.has(provider)) {
          setError(`현재 백엔드에서는 ${label} 로그인을 지원하지 않습니다.`);
          return;
        }

        try {
          window.FirstBiteApi.beginSocialLogin(provider, nextPage());
        } catch (error) {
          setError(error.message || `${label} 로그인을 시작하지 못했습니다.`);
        }
      });
    });
  });
})();
