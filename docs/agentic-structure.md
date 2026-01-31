# Agentic Chat Flow

This doc explains how the current chat flow behaves, where state is stored, and how
LangChain is used in this repo.

## What Is LangChain?

LangChain is a framework for building applications that use LLMs. It provides
common building blocks like model wrappers, message formats, prompt templates,
and tool calling patterns so you can compose multi-step behaviors without
manually handling raw API calls.

In this repo, LangChain is used as the interface to OpenAI models. We use its
message abstractions to pass a conversation history to the model and receive a
structured response that controls when an issue should be created.

## How LangChain Fits Here

- We create a `ChatOpenAI` model wrapper, which handles the OpenAI API call.
- We build a list of messages (`SystemMessage`, `HumanMessage`, `AIMessage`)
  to represent the conversation so far.
- We add system-level instructions that ask for a strict JSON response with a
  `ready_to_create` flag, which drives issue creation.
- The final output is fed back into the app logic to decide whether to keep
  asking questions or escalate the issue.

## Core Behavior

- Each `/api/chat` call stores the user message and the assistant reply in `chat_messages`.
- Conversation history is loaded from the database and passed to the model so it can respond with context.
- The model decides if it has enough information to escalate the issue.

## Memory Storage

- History is pulled from `chat_messages` for the same `tenant_id` + `property_id`.
- The last 12 messages are included (oldest to newest) when the model responds.
- This gives multi‑turn continuity without an in‑memory cache.

## Readiness And Issue Creation

- The model is instructed to return JSON with:
  - `response` (string)
  - `ready_to_create` (boolean)
- If `ready_to_create` is `true`, an `issues` record is created.
- If `false`, the assistant asks one concise follow‑up question.

## Cost And Vendor Handling

- Category, vendor match, and cost are calculated with rule‑based helpers in `app/services/ai_tools.py`.
- Estimated cost is passed as context to the model.
- Vendor identity is not exposed to the tenant in responses.

## Files

- Agent logic: `app/services/ai_agent.py`
- Chat route: `app/api/routers/chat.py`
