import type { Request, Response } from 'express';

import { getStripePublishableKey } from '../stripe/client.js';

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
      gap: ${isCardLayout ? '12px' : '16px'};
    }
    #root.card-layout {
      justify-content: flex-end;
    }
    .label {
      font-family: Inter, system-ui, sans-serif;
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: rgba(167, 243, 208, 0.85);
      margin-bottom: 6px;
    }
    .number-row { min-height: ${isCardLayout ? '28px' : '32px'}; width: 100%; }
    .cvc-row { min-height: ${isCardLayout ? '22px' : '28px'}; min-width: ${isCardLayout ? '40px' : '72px'}; }
    .copy-row { min-height: ${isCardLayout ? '28px' : '36px'}; min-width: ${isCardLayout ? '72px' : '120px'}; }
    .details-row {
      display: flex;
      flex-direction: row;
      align-items: flex-end;
      justify-content: flex-end;
      gap: ${isCardLayout ? '12px' : '16px'};
    }
    .card-layout .details-row {
      padding-left: 96px;
    }
    .StripeElement,
    .StripeElement iframe {
      width: 100% !important;
      min-height: ${isCardLayout ? '22px' : '28px'} !important;
      opacity: 1 !important;
    }
  </style>
</head>
<body>
  <div id="root" class="${isCardLayout ? 'card-layout' : ''}">
    ${isCardLayout ? '' : '<div><div class="label">Card number</div>'}
    <div id="number-mount" class="number-row"></div>
    ${isCardLayout ? '' : '</div>'}
    <div class="details-row">
      ${isCardLayout ? '' : '<div><div class="label">CVV</div>'}
      <div id="cvc-mount" class="cvc-row"></div>
      ${isCardLayout ? '' : '</div>'}
      <div id="copy-mount" class="copy-row"></div>
    </div>
  </div>
  <script>
    const params = new URLSearchParams(window.location.search);
    const publishableKey = params.get('pk') || ${JSON.stringify(publishableKey)};
    const stripeAccount = params.get('account');
    const isCardLayout = ${JSON.stringify(isCardLayout)};

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
            fontSize: '17px',
            letterSpacing: '0.12em',
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
            fontSize: '14px',
            letterSpacing: '0.06em',
            lineHeight: '22px',
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
