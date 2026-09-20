interface TelegramMessage {
  text: string;
  reply_markup?: {
    inline_keyboard: Array<Array<{
      text: string;
      url: string;
    }>>;
  };
}

export async function sendTelegramMessage(
  text: string,
  inlineButtons?: Array<{ text: string; url: string }>
): Promise<{ success: boolean; error?: string }> {
  console.log('[TELEGRAM LIB] sendTelegramMessage called');
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  console.log('[TELEGRAM LIB] Token exists:', !!botToken);
  console.log('[TELEGRAM LIB] ChatId exists:', !!chatId);

  if (!botToken || !chatId) {
    console.warn('[TELEGRAM LIB] Telegram not configured');
    return { success: false, error: 'Telegram not configured' };
  }

  const message: TelegramMessage = { text };

  if (inlineButtons && inlineButtons.length > 0) {
    message.reply_markup = {
      inline_keyboard: [inlineButtons],
    };
  }

  try {
    console.log('[TELEGRAM LIB] Sending request to Telegram API...');
    const response = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message.text,
          parse_mode: 'HTML',
          reply_markup: message.reply_markup,
        }),
      }
    );

    console.log('[TELEGRAM LIB] Response status:', response.status);
    const data = await response.json();
    console.log('[TELEGRAM LIB] Response data:', data);

    if (!data.ok) {
      throw new Error(data.description || 'Telegram API error');
    }

    console.log('[TELEGRAM LIB] Message sent successfully');
    return { success: true };
  } catch (error) {
    console.error('[TELEGRAM LIB] Telegram send failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function retryWithBackoff<T extends { success: boolean; error?: string }>(
  fn: () => Promise<T>,
  maxRetries = 3,
  delays = [1000, 3000, 5000]
): Promise<T> {
  console.log(`[TELEGRAM LIB] retryWithBackoff: maxRetries=${maxRetries}`);
  let lastResult: T | undefined;

  for (let i = 0; i < maxRetries; i++) {
    try {
      console.log(`[TELEGRAM LIB] Attempt ${i + 1}/${maxRetries}`);
      const result = await fn();
      console.log(`[TELEGRAM LIB] Attempt ${i + 1} result:`, result);

      // ถ้าสำเร็จ ให้ return ทันที
      if (result.success) {
        console.log(`[TELEGRAM LIB] Attempt ${i + 1} succeeded`);
        return result;
      }

      // ถ้าล้มเหลว เก็บไว้แล้ว retry
      lastResult = result;
      console.error(`[TELEGRAM LIB] Attempt ${i + 1} failed:`, result.error);

      if (i < maxRetries - 1) {
        const delay = delays[i];
        console.log(`[TELEGRAM LIB] Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    } catch (error) {
      // กรณี network error หรือ exception อื่นๆ
      console.error(`[TELEGRAM LIB] Attempt ${i + 1} threw error:`, error);
      lastResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      } as T;

      if (i < maxRetries - 1) {
        const delay = delays[i];
        console.log(`[TELEGRAM LIB] Waiting ${delay}ms before retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  console.error(`[TELEGRAM LIB] All ${maxRetries} attempts failed`);
  return lastResult!;
}
