import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    let body: any = {};
    if (rawBody) {
      try {
        body = JSON.parse(rawBody);
      } catch (e) {
        return NextResponse.json({ reply: 'Invalid JSON payload sent from UI.' }, { status: 200 });
      }
    }

    const { message = '', threadId = null, context = {} } = body;
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { reply: '⚠️ OPENAI_API_KEY is not set in frontend/.env.local.' },
        { status: 200 }
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey.trim()}`,
      'OpenAI-Beta': 'assistants=v2',
      'OpenAI-Project': 'proj_CqxE0oMva4LEhK41Vs0aaWuP',
    };

    // Helper for safe fetching with error logging
    const safeFetch = async (url: string, options: any) => {
      const res = await fetch(url, options);
      const text = await res.text();
      if (!text) {
        throw new Error(`Empty response from OpenAI (${res.status} ${res.statusText})`);
      }
      try {
        return JSON.parse(text);
      } catch (e) {
        throw new Error(`Invalid JSON from OpenAI: ${text.slice(0, 100)}`);
      }
    };

    // 1. Get or Create Assistant
    let assistantId = process.env.OPENAI_ASSISTANT_ID;
    if (!assistantId) {
      const assistantData = await safeFetch('https://api.openai.com/v1/assistants', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: 'Flick Money Studio Co-pilot',
          instructions: 'You are Flick, an AI financial co-pilot for Money Studio.',
          model: 'gpt-4o-mini',
        }),
      });

      if (assistantData.error) {
        return NextResponse.json({ reply: `OpenAI Error: ${assistantData.error.message}` }, { status: 200 });
      }
      assistantId = assistantData.id;
    }

    // 2. Get or Create Thread
    let activeThreadId = threadId;
    if (!activeThreadId) {
      const threadData = await safeFetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers,
      });

      if (threadData.error) {
        return NextResponse.json({ reply: `OpenAI Error: ${threadData.error.message}` }, { status: 200 });
      }
      activeThreadId = threadData.id;
    }

    // 3. Post Message
    const enrichedMessage = `Context: ${JSON.stringify(context || {})}\n\nUser Question: ${message}`;
    const msgRes = await safeFetch(`https://api.openai.com/v1/threads/${activeThreadId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        role: 'user',
        content: enrichedMessage,
      }),
    });

    if (msgRes.error) {
      return NextResponse.json({ reply: `OpenAI Error: ${msgRes.error.message}` }, { status: 200 });
    }

    // 4. Create Run
    let runData = await safeFetch(`https://api.openai.com/v1/threads/${activeThreadId}/runs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ assistant_id: assistantId }),
    });

    if (runData.error) {
      return NextResponse.json({ reply: `OpenAI Error: ${runData.error.message}` }, { status: 200 });
    }

    // 5. Poll Run Status
    let attempts = 0;
    while ((runData.status === 'queued' || runData.status === 'in_progress') && attempts < 15) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      runData = await safeFetch(
        `https://api.openai.com/v1/threads/${activeThreadId}/runs/${runData.id}`,
        { headers }
      );
      attempts++;
    }

    // 6. Get Latest Message
    const messagesData = await safeFetch(
      `https://api.openai.com/v1/threads/${activeThreadId}/messages`,
      { headers }
    );

    const lastMsg = messagesData.data?.find((m: any) => m.role === 'assistant');
    const reply = lastMsg?.content?.[0]?.text?.value || 'Request complete.';

    return NextResponse.json({ reply, threadId: activeThreadId });
  } catch (err: any) {
    return NextResponse.json(
      { reply: `Server Details: ${err?.message || 'Unknown error.'}` },
      { status: 200 }
    );
  }
}