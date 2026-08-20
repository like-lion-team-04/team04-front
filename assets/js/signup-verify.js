(function () {
  "use strict";

  const REQUEST_KEY = "firstbite.phoneVerificationRequest";
  const TOKEN_KEY = "firstbite.verificationToken";

  function readStored(key) {
    try {
      return JSON.parse(sessionStorage.getItem(key));
    } catch (_error) {
      return null;
    }
  }

  function normalizePhoneNumber(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function verificationMessage(error) {
    const messages = {
      AUTH_PHONE_NUMBER_DUPLICATED: "이미 가입된 휴대폰 번호입니다. 로그인해 주세요.",
      PHONE_VERIFICATION_RATE_LIMITED: "인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
      PHONE_VERIFICATION_NOT_FOUND: "인증 요청을 찾을 수 없습니다. 다시 인증해 주세요.",
      PHONE_VERIFICATION_ALREADY_CONFIRMED: "이미 확인된 인증 요청입니다. 회원가입을 계속 진행해 주세요.",
      PHONE_VERIFICATION_EXPIRED: "인증 요청이 만료되었습니다. 다시 인증해 주세요.",
      PHONE_VERIFICATION_PROVIDER_RATE_LIMITED: "인증 기관 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
      PHONE_VERIFICATION_PROVIDER_UNAVAILABLE: "인증 기관에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      PHONE_VERIFICATION_PROVIDER_ERROR: "휴대폰 인증 확인 중 문제가 발생했습니다. 다시 시도해 주세요.",
      COMMON_NETWORK_ERROR: "서버에 연결할 수 없습니다. 백엔드 실행 상태를 확인해 주세요."
    };
    return messages[error.code] || error.message;
  }

  document.addEventListener("DOMContentLoaded", () => {
    const card = document.querySelector(".verification-card");
    const notice = document.querySelector(".signup-notice");
    if (!card || !notice || !window.FirstBiteApi) return;

    // 이전 인증 토큰이 남아 있다면 바로 정보입력 단계로 이어간다.
    const verified = readStored(TOKEN_KEY);
    if (verified && verified.token && verified.expiresAt > Date.now()) {
      window.location.replace("signup-info.html");
      return;
    }
    sessionStorage.removeItem(TOKEN_KEY);

    let request = readStored(REQUEST_KEY);
    if (request && (!request.expiresAt || request.expiresAt <= Date.now())) {
      sessionStorage.removeItem(REQUEST_KEY);
      request = null;
    }

    const showPendingMessage = () => {
      if (!request) return;
      notice.textContent = `${request.recipientNumber}로 “${request.messageText}” 문자를 보낸 뒤 휴대폰 인증을 다시 눌러 확인해 주세요.`;
    };
    if (request) showPendingMessage();

    const setBusy = (busy) => {
      card.setAttribute("aria-busy", String(busy));
      card.style.pointerEvents = busy ? "none" : "";
    };

    const resetRequest = () => {
      sessionStorage.removeItem(REQUEST_KEY);
      request = null;
    };

    card.addEventListener("click", async (event) => {
      event.preventDefault();
      setBusy(true);

      try {
        if (request) {
          const result = await window.FirstBiteApi.confirmPhoneVerification(request.requestId);
          if (result.status === "VERIFIED" && result.verificationToken) {
            sessionStorage.setItem(TOKEN_KEY, JSON.stringify({
              token: result.verificationToken,
              phoneNumber: request.phoneNumber,
              expiresAt: Date.now() + (result.expiresIn || 600) * 1000
            }));
            resetRequest();
            window.location.assign("signup-info.html");
            return;
          }

          showPendingMessage();
          if (request.smsUri && window.confirm("아직 문자가 확인되지 않았습니다. 문자 앱을 다시 여시겠어요?")) {
            window.location.href = request.smsUri;
          }
          return;
        }

        const entered = window.prompt("휴대폰 번호를 '-' 없이 입력해 주세요.");
        if (entered === null) return;

        const phoneNumber = normalizePhoneNumber(entered);
        if (!/^010\d{8}$/.test(phoneNumber)) {
          notice.textContent = "010으로 시작하는 휴대폰 번호 11자리를 입력해 주세요.";
          return;
        }

        const result = await window.FirstBiteApi.createPhoneVerification(phoneNumber);
        request = {
          ...result,
          phoneNumber,
          expiresAt: Date.now() + (result.expiresIn || 300) * 1000
        };
        sessionStorage.setItem(REQUEST_KEY, JSON.stringify(request));
        showPendingMessage();

        if (result.smsUri && window.confirm("문자 앱에서 준비된 인증 문구를 전송해 주세요. 문자 앱을 여시겠어요?")) {
          window.location.href = result.smsUri;
        }
      } catch (error) {
        if ([404, 410].includes(error.status) || error.code === "PHONE_VERIFICATION_ALREADY_CONFIRMED") {
          resetRequest();
        }
        notice.textContent = verificationMessage(error);
      } finally {
        setBusy(false);
      }
    });
  });
})();
