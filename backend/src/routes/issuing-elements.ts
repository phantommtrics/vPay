import type { Request, Response } from 'express';

import { getStripePublishableKey } from '../stripe/client.js';

function vpayWordmarkSvg(width = 96, height = 31): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 220 72" role="img" aria-label="VPay Africa" style="display:block;background:transparent;">
  <text font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif" font-size="46" font-weight="700" letter-spacing="-1.5">
    <tspan x="4" y="46" fill="#4A80E8">V</tspan><tspan fill="#FFFFFF">Pay</tspan>
  </text>
  <text x="5" y="64" font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif" font-size="12" font-weight="500" letter-spacing="5.5" fill="#8A95A8">AFRICA</text>
  <rect x="4" y="68" width="52" height="2" rx="1" fill="#E8A020"/>
</svg>`;
}

export function handleIssuingElementsPage(req: Request, res: Response): void {
  const publishableKey = getStripePublishableKey() ?? '';
  const layout = typeof req.query.layout === 'string' ? req.query.layout : 'full';
  const isCardLayout = layout === 'card';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
  <script src="https://js.stripe.com/v3/"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: 100%;
      height: 100%;
      background: ${isCardLayout ? 'transparent' : '#064e3b'};
      color: #fff;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    #root {
      width: 100%;
      min-height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: ${isCardLayout ? '0' : '12px'};
      gap: ${isCardLayout ? '10px' : '16px'};
    }
    #root.card-layout {
      justify-content: flex-end;
      gap: 8px;
    }
    .vpay-wordmark {
      flex-shrink: 0;
      line-height: 0;
      background: transparent;
    }
    .label {
      font-family: Inter, system-ui, sans-serif;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(167, 243, 208, 0.85);
      margin-bottom: 2px;
    }
    .number-row {
      min-height: ${isCardLayout ? '28px' : '32px'};
      width: 100%;
      padding-right: ${isCardLayout ? '36px' : '0'};
    }
    .cvc-row { min-height: ${isCardLayout ? '20px' : '28px'}; }
    .copy-row { min-height: ${isCardLayout ? '20px' : '36px'}; }
    .details-row {
      display: flex;
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
      gap: ${isCardLayout ? '8px' : '16px'};
      width: 100%;
      min-width: 0;
    }
    .holder-col {
      flex: 1 1 0;
      min-width: 0;
      overflow: hidden;
    }
    .holder-value,
    .expiry-value {
      color: #fff;
      font-family: Inter, system-ui, sans-serif;
      font-size: clamp(10px, 3.2vw, 13px);
      font-weight: 600;
      letter-spacing: 0.08em;
      line-height: 18px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .expiry-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: clamp(11px, 3.4vw, 14px);
      letter-spacing: 0.04em;
    }
    .expiry-col,
    .cvc-col,
    .copy-col {
      flex: 0 0 auto;
    }
    .cvc-col {
      min-width: 36px;
    }
    .copy-col {
      max-width: 52px;
      overflow: hidden;
    }
    .StripeElement,
    .StripeElement iframe {
      width: 100% !important;
      min-height: ${isCardLayout ? '20px' : '28px'} !important;
      opacity: 1 !important;
    }
  </style>
</head>
<body>
  <div id="root" class="${isCardLayout ? 'card-layout' : ''}">
    ${isCardLayout ? `<div class="vpay-wordmark">${vpayWordmarkSvg()}</div>` : ''}
    ${isCardLayout ? '' : '<div><div class="label">Card number</div>'}
    <div id="number-mount" class="number-row"></div>
    ${isCardLayout ? '' : '</div>'}
    <div class="details-row">
      ${
        isCardLayout
          ? `<div class="holder-col">
        <div class="label">Cardholder</div>
        <div class="holder-value" id="holder-display"></div>
      </div>
      <div class="expiry-col">
        <div class="label">Valid Thru</div>
        <div class="expiry-value" id="expiry-display"></div>
      </div>
      <div class="cvc-col">
        <div class="label">CVV</div>
        <div id="cvc-mount" class="cvc-row"></div>
      </div>
      <div class="copy-col">
        <div id="copy-mount" class="copy-row"></div>
      </div>`
          : `<div><div class="label">CVV</div>
      <div id="cvc-mount" class="cvc-row"></div></div>
      <div id="copy-mount" class="copy-row"></div>`
      }
    </div>
  </div>
  <script>
    const params = new URLSearchParams(window.location.search);
    const publishableKey = params.get('pk') || ${JSON.stringify(publishableKey)};
    const stripeAccount = params.get('account');
    const isCardLayout = ${JSON.stringify(isCardLayout)};
    const holderName = params.get('holder') || '';
    const expiryLabel = params.get('expiry') || '';

    if (isCardLayout) {
      const holderEl = document.getElementById('holder-display');
      const expiryEl = document.getElementById('expiry-display');
      if (holderEl) holderEl.textContent = holderName;
      if (expiryEl) expiryEl.textContent = expiryLabel;
    }

    const stripeOptions = { betas: ['issuing_elements_2'] };
    if (stripeAccount) stripeOptions.stripeAccount = stripeAccount;

    let stripe = null;

    function post(message) {
      const payload = JSON.stringify(message);
      if (window.ReactNativeWebView) {
        window.ReactNativeWebView.postMessage(payload);
      }
    }

    function initStripe() {
      if (stripe || !publishableKey) return;
      stripe = Stripe(publishableKey, stripeOptions);
    }

    async function mountAll(cardId, nonce, ephemeralKeySecret) {
      initStripe();
      if (!stripe) throw new Error('Stripe publishable key is missing');

      await stripe.retrieveIssuingCard(cardId, {
        ephemeralKeySecret,
        nonce,
        expand: ['number', 'cvc'],
      });

      const numberStyle = isCardLayout
        ? {
            color: '#ffffff',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 'clamp(13px, 4.2vw, 17px)',
            letterSpacing: '0.08em',
            lineHeight: '28px',
          }
        : {
            color: '#ffffff',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '18px',
            letterSpacing: '0.14em',
            lineHeight: '28px',
          };

      const cvcStyle = isCardLayout
        ? {
            color: '#ffffff',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 'clamp(11px, 3.4vw, 14px)',
            letterSpacing: '0.04em',
            lineHeight: '20px',
          }
        : {
            color: '#ffffff',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '16px',
            letterSpacing: '0.08em',
            lineHeight: '24px',
          };

      const mounts = [
        {
          type: 'issuingCardNumberDisplay',
          target: '#number-mount',
          field: 'number',
          style: numberStyle,
        },
        {
          type: 'issuingCardCvcDisplay',
          target: '#cvc-mount',
          field: 'cvc',
          style: cvcStyle,
        },
        {
          type: 'issuingCardCopyButton',
          target: '#copy-mount',
          field: 'copy',
          style: { ...cvcStyle, fontSize: isCardLayout ? '12px' : '13px' },
        },
      ];

      let readyCount = 0;

      for (const spec of mounts) {
        const el = stripe.elements().create(spec.type, {
          issuingCard: cardId,
          nonce,
          ephemeralKeySecret,
          style: { base: spec.style },
        });
        el.mount(spec.target);
        el.on('ready', () => {
          readyCount += 1;
          post({ type: 'ready', field: spec.field });
          if (readyCount >= mounts.length) {
            post({ type: 'allReady' });
          }
        });
      }
    }

    async function handleCommand(data) {
      try {
        if (data.type === 'reveal') {
          initStripe();
          const nonceResult = await stripe.createEphemeralKeyNonce({ issuingCard: data.cardId });
          post({
            type: 'nonce',
            nonce: nonceResult.nonce,
            cardId: data.cardId,
          });
          return;
        }

        if (data.type === 'mount') {
          await mountAll(data.cardId, data.nonce, data.ephemeralKeySecret);
        }
      } catch (err) {
        post({
          type: 'error',
          message: err && err.message ? err.message : 'Failed to load card details',
        });
      }
    }

    window.__vpayHandleCommand = handleCommand;

    window.addEventListener('load', () => {
      post({ type: 'loaded' });
    });
  </script>
</body>
</html>`);
}
