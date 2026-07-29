# Protoface Quickstart for Conversation Embeds

This quickstart is the easiest way to preview a Protoface conversation embed in a React app. Simply follow the steps listed below.

## About Protoface

Protoface adds a real-time avatar to your AI app or agent.

Get a **free** account at [protoface.com](https://protoface.com/?utm_source=github&utm_medium=referral&utm_campaign=github_docs&utm_content=protoface-conversation-test-app).

Read the docs at [docs.protoface.com](https://docs.protoface.com/?utm_source=github&utm_medium=referral&utm_campaign=github_docs&utm_content=protoface-conversation-test-app).

To see quickstarts for other platforms, visit the [quickstart repo](https://github.com/protoface-ai/protoface-quickstart).

## Get Started

1. Copy `.env.example` for your local `.env` file and put in your Protoface embed id.

```js
VITE_PROTOFACE_EMBED_ID="emb__...your embed id..."
```

2. Install the needed packages.

```bash
npm install
```

3. Run the dev server and head to [the site](http://127.0.0.1:5173).

```bash
npm run dev
```

## How It Works

The app loads a Protoface conversation embed config and renders the hosted conversation flow:

1. `useProtofaceConversation()` loads the embed config from Protoface.
2. The browser asks for microphone access when the user starts the conversation.
3. The SDK confirms consent when required by the embed.
4. `ProtofaceAvatar` connects to the LiveKit room returned by Protoface and renders the avatar.
5. The app shows session status, microphone state, vision state, and transcript updates.

This flow never exposes Protoface API keys, worker tokens, or LiveKit room credentials to your browser code.

## Avatars

Find avatars you like or create your own on [the Protoface dashboard](https://app.protoface.com?utm_source=github&utm_medium=referral&utm_campaign=github_docs&utm_content=protoface-conversation-test-app). Use the dashboard to create or update a conversation embed, then replace the `.env` value for `VITE_PROTOFACE_EMBED_ID`.

Alternatively, find the API spec for creating, retrieving, and maintaining avatars at [docs.protoface.com](https://docs.protoface.com/guides/avatars?utm_source=github&utm_medium=referral&utm_campaign=github_docs&utm_content=protoface-conversation-test-app).

## Protoface: More Quickstarts

Protoface integrates with popular voice AI platforms.

Clone a starter repo, add your keys to the environment file, and run.

If an SDK or plugin is available separately, we've linked to it instead.

| Platform | Link |
| --- | --- |
| LiveKit | [Plugin](https://github.com/livekit/agents/tree/main/livekit-plugins/livekit-plugins-protoface) [Official Docs](https://docs.livekit.io/agents/models/avatar/plugins/protoface/)|
| Pipecat | [Plugin](https://github.com/protoface-ai/protoface-plugin-pipecat) [Official Docs](https://docs.pipecat.ai/api-reference/server/services/video/protoface)|
| Agora | [Starter Repo](https://github.com/protoface-ai/protoface-quickstart-agora) |
| Vapi | [Starter Repo](https://github.com/protoface-ai/protoface-quickstart-vapi) |
| ElevenLabs Agents | [Starter Repo](https://github.com/protoface-ai/protoface-quickstart-elevenlabs-agents) |
| OpenAI Realtime | [Starter Repo](https://github.com/protoface-ai/protoface-quickstart-openai-realtime) |
| VideoSDK | [Starter Repo](https://github.com/protoface-ai/protoface-quickstart-videosdk) |
| Python | [SDK](https://github.com/protoface-ai/protoface-sdk-python) |
| Node.js | [SDK](https://github.com/protoface-ai/protoface-sdk-node) |
