# PROJECT_GOAL.md

## Project Overview

**Dawn** is an AI-native design platform that puts expert-level product design in the hands of anyone — starting with developers, founders, and product teams who need to create usable, on-brand interfaces fast.

The core of Dawn is a **computational design engine**: a system that encodes the language of design — structure, style, semantics, and UX principles — into a form that machines can understand and generate from.
This enables **instant, editable, high-quality product design**, built directly from intent or source pages.

---

## Mission

> Make great design computable — so that anyone can build products worth shipping.

---

## Product Vision

LLMs can generate functioning code in seconds, but design remains the bottleneck. Interfaces still need taste, structure, and system-level understanding.

Dawn bridges that gap by:

* **Capturing** design knowledge from real products.
* **Encoding** it into **vectors** and **rules** that model brand style and UX best practices.
* **Synthesising** new, editable, production-ready layouts directly from goals or URLs.

The result:
Designs that are **usable**, **on-brand**, and **ready to ship**, not static mockups.

---

## Core MVP Goal

Deliver a working **end-to-end system** that:

1. Accepts a URL or text prompt.
2. Captures and analyses its design (style, components, semantics).
3. Encodes that design into a **Style Vector**.
4. Synthesises a **new editable scene** in the same brand and UX style.
5. Renders the result in a live, **canvas editor** for export (JSON/SVG).

---

## MVP Architecture Summary

| Layer                   | Objective                                                            | Key Components                                           |
| ----------------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| **Frontend Platform**   | The user-facing app: canvas, auth, projects, job UI.                 | Next.js + tldraw/Konva + NextAuth + Socket.IO.           |
| **Capture**             | Deterministically extract style and component data from source URLs. | Playwright + CSSOM + heuristics + clustering.            |
| **Analysis**            | Interpret structure, tone, and intent.                               | LLM reasoning layer + schema validation.                 |
| **Design Intelligence** | Encode brand style and UX rules.                                     | Style Embeddings (pgvector/FAISS) + UX Library.          |
| **Synthesis**           | Generate layouts consistent with style and goals.                    | Deterministic layout composer + component orchestration. |
| **Output**              | Export editable vectors (v1) and production code (later).            | JSON/SVG exporters, later React/Tailwind codegen.        |

---

## Acceptance Criteria (MVP)

* **URL → editable design:** Users can input a URL and see its components rendered in the canvas.
* **Basic editability:** Resize, reposition, and modify properties interactively.
* **Export fidelity:** Exported SVG/JSON matches the source design with >0.95 SSIM similarity.
* **Job reliability:** Jobs are idempotent, progress is streamed, and errors are actionable.
* **Human eval:** Synthesised designs are judged “on-brand and fit for goal” ≥70% of the time.

---

## Success Definition

A successful MVP demonstrates that:

* Dawn can **encode and regenerate** a brand’s style with measurable fidelity.
* The editor provides a **smooth, “Figma-like” interaction layer**.
* Non-designers can achieve **usable, aesthetic results** from text or example inputs.
* The system captures learnings from edits to improve the underlying embeddings.

---

## Next Milestones

1. **Alpha (Design Partner MVP)**

   * URL ingestion → vectorised canvas.
   * Style and component capture pipeline.
   * Basic layout synthesis from prompt + brand style.

2. **Beta (Public Waitlist)**

   * Real-time editing and export.
   * Retrieval from Style Embeddings for “on-brand” suggestions.
   * UX Library rule enforcement and autofix.

3. **Public Launch**

   * Seamless collaboration, Figma/React exports.
   * Design intelligence continuously improving from user edits.

---

## Technical North Star

> **Design as data.**
> Encode every visual and experiential principle — color, rhythm, hierarchy, tone — as a composable, computable representation.

This becomes the foundation for:

* Automated design synthesis.
* Cross-brand style retrieval.
* Continuous learning from user interaction.
