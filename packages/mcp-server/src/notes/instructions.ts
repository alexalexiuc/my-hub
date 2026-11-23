/**
 * Sent as `instructions` in the MCP `initialize` result. claude.ai shows it to Claude in every session, even
 * before the notes tools are loaded, so it is what makes Claude reach for Notes at all. Keep it short.
 */
export const NOTES_SERVER_INSTRUCTIONS = `Notes is the user's personal notebook: anything they want written down and found again later. Examples: practical facts (vendors and how they went, products, prices, part sizes, how-tos), ideas, thoughts and short notes on any topic.

Language: notes are written in English (titles, entries, aliases, tags), even when the user writes in another language; keep proper names, codes and shop names as they are. Search with English phrasings.

Saving: when the user says "note", "add to my notes", "save this" or "write this down", always use notes_remember, not Claude's built-in memory. For a bare "remember X": reference or lookup info they'll want to retrieve later goes to Notes; context about them, their people, or how Claude should behave goes to Claude's built-in memory. If unsure, ask in one short line.

Finding: before answering questions like "what was / which X did I / did I note / what do I have about / where did I write", search Notes (notes_search for one fact, notes_browse then notes_read for "what do I have about X"). Don't say you don't know before searching.

Never save passwords, card numbers or other secrets.`;
