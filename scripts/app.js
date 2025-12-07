import { hero, sections, clippings, glossary } from "../data/content.js";
import { GOOGLE_SCRIPT_URL, USE_LOCAL_FALLBACK_ONLY } from "./comment-config.js";

const state = {
    currentTargetId: null,
    currentTargetLabel: "",
    commentsCache: {},
    isPanelOpen: false
};

document.addEventListener("DOMContentLoaded", () => {
    renderHero();
    renderNarrative();
    renderClippings();
    renderGlossary();
    wireGlobalEvents();
});

function renderHero() {
    const heroEl = document.querySelector("[data-hero]");
    if (!heroEl) return;

    heroEl.querySelector("[data-hero-image]").setAttribute("src", hero.image);
    heroEl.querySelector("[data-hero-image]").setAttribute("alt", hero.headline || hero.title);
    heroEl.querySelector("[data-hero-title]").textContent = hero.title;
    heroEl.querySelector("[data-hero-dek]").textContent = hero.dek;
    heroEl.querySelector("[data-hero-caption]").textContent = hero.caption;
    heroEl.querySelector("[data-hero-quote]").textContent = `"${hero.pullQuote}"`;

    const introEl = heroEl.querySelector("[data-hero-intro]");
    hero.intro.forEach((paragraph) => {
        const p = document.createElement("p");
        p.textContent = paragraph;
        introEl.appendChild(p);
    });
}

function renderNarrative() {
    const grid = document.querySelector("[data-narrative-grid]");
    if (!grid) return;

    sections.forEach((section) => {
        const article = document.createElement("article");
        article.className = "narrative-card";
        article.id = section.id;
        article.dataset.segmentId = section.id;
        article.dataset.segmentType = "section";

        const header = document.createElement("header");
        header.className = "narrative-card__header";

        const title = document.createElement("h2");
        title.textContent = section.title;
        header.appendChild(title);

        const summary = document.createElement("p");
        summary.className = "narrative-card__summary";
        summary.textContent = section.summary;
        header.appendChild(summary);

        article.appendChild(header);

        const body = document.createElement("div");
        body.className = "narrative-card__body";

        section.body.forEach((paragraph) => {
            const p = document.createElement("p");
            p.textContent = paragraph;
            body.appendChild(p);
        });

        article.appendChild(body);

        if (section.relatedClippings?.length) {
            const relatedWrapper = document.createElement("div");
            relatedWrapper.className = "related-clippings";
            const label = document.createElement("p");
            label.className = "related-clippings__label";
            label.textContent = "Related clippings";
            relatedWrapper.appendChild(label);

            const list = document.createElement("div");
            list.className = "related-clippings__list";

            section.relatedClippings.forEach((clipId) => {
                const clip = clippings.find((c) => c.id === clipId);
                if (!clip) return;
                const button = document.createElement("button");
                button.type = "button";
                button.className = "related-clippings__chip js-comment-trigger";
                button.dataset.segmentId = clip.id;
                button.dataset.segmentType = "clipping";
                button.dataset.label = clip.headline;
                button.textContent = clip.headline;
                list.appendChild(button);
            });

            relatedWrapper.appendChild(list);
            article.appendChild(relatedWrapper);
        }

        const cta = document.createElement("button");
        cta.type = "button";
        cta.className = "ghost-button js-comment-trigger";
        cta.dataset.segmentId = section.id;
        cta.dataset.segmentType = "section";
        cta.dataset.label = section.title;
        cta.textContent = "Comment on this section";
        article.appendChild(cta);

        grid.appendChild(article);
    });
}

function renderClippings() {
    const gallery = document.querySelector("[data-clipping-grid]");
    if (!gallery) return;

    clippings.forEach((clip) => {
        const card = document.createElement("article");
        card.className = "clipping-card";
        card.dataset.segmentId = clip.id;
        card.dataset.segmentType = "clipping";

        const img = document.createElement("img");
        img.src = clip.image;
        img.alt = clip.headline;
        card.appendChild(img);

        const meta = document.createElement("div");
        meta.className = "clipping-card__meta";

        const headline = document.createElement("h3");
        headline.textContent = clip.headline;
        meta.appendChild(headline);

        const source = document.createElement("p");
        source.className = "clipping-card__source";
        source.textContent = `${clip.source} • ${clip.date}`;
        meta.appendChild(source);

        const body = document.createElement("p");
        body.textContent = clip.body;
        meta.appendChild(body);

        card.appendChild(meta);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "ghost-button ghost-button--tight js-comment-trigger";
        button.dataset.segmentId = clip.id;
        button.dataset.segmentType = "clipping";
        button.dataset.label = clip.headline;
        button.textContent = "Discuss this clipping";
        card.appendChild(button);

        gallery.appendChild(card);
    });
}

function renderGlossary() {
    const list = document.querySelector("[data-glossary]");
    if (!list) return;

    glossary.forEach((item) => {
        const entry = document.createElement("div");
        entry.className = "glossary-entry";

        const term = document.createElement("h4");
        term.textContent = item.term;
        entry.appendChild(term);

        const definition = document.createElement("p");
        definition.textContent = item.definition;
        entry.appendChild(definition);

        list.appendChild(entry);
    });
}

function wireGlobalEvents() {
    document.body.addEventListener("click", (event) => {
        if (event.target.closest(".js-comment-trigger")) {
            const trigger = event.target.closest(".js-comment-trigger");
            openCommentPanel(trigger.dataset.segmentId, trigger.dataset.label || "", trigger.dataset.segmentType || "section");
        }

        if (event.target.matches("[data-comment-close]")) {
            event.preventDefault();
            closeCommentPanel();
        }
    });

    const form = document.querySelector("[data-comment-form]");
    if (form) {
        form.addEventListener("submit", async (event) => {
            event.preventDefault();
            const formData = new FormData(form);
            const payload = {
                name: formData.get("name")?.trim() || "Anonymous",
                comment: formData.get("comment")?.trim() || "",
                segmentId: state.currentTargetId,
                segmentType: form.dataset.segmentType || "section"
            };

            if (!payload.comment) {
                setStatus("Please enter a comment before submitting.", true);
                return;
            }

            try {
                setStatus("Saving comment...", false);
                await saveComment(payload);
                form.reset();
                await refreshComments();
                setStatus("Comment posted.");
            } catch (error) {
                console.error(error);
                setStatus("Unable to save to Google Sheets. Stored locally for now.", true);
            }
        });
    }
}

function openCommentPanel(segmentId, label, type) {
    if (!segmentId) return;
    state.currentTargetId = segmentId;
    state.currentTargetLabel = label;

    const panel = document.querySelector("[data-comment-panel]");
    const title = document.querySelector("[data-comment-title]");
    const form = document.querySelector("[data-comment-form]");

    if (panel) {
        panel.classList.add("comment-panel--open");
        state.isPanelOpen = true;
    }

    if (title) {
        title.textContent = label || "Comments";
    }

    if (form) {
        form.dataset.segmentType = type;
    }

    refreshComments();
}

function closeCommentPanel() {
    const panel = document.querySelector("[data-comment-panel]");
    if (panel) {
        panel.classList.remove("comment-panel--open");
    }
    state.isPanelOpen = false;
    state.currentTargetId = null;
}

async function refreshComments() {
    const list = document.querySelector("[data-comment-list]");
    if (!list || !state.currentTargetId) return;

    list.innerHTML = "";
    const loader = document.createElement("p");
    loader.className = "comment-panel__loading";
    loader.textContent = "Loading comments...";
    list.appendChild(loader);

    const comments = await getComments(state.currentTargetId);

    list.innerHTML = "";

    if (!comments.length) {
        const empty = document.createElement("p");
        empty.className = "comment-panel__empty";
        empty.textContent = "Be the first to share a thought.";
        list.appendChild(empty);
        return;
    }

    comments.forEach((item) => {
        const comment = document.createElement("article");
        comment.className = "comment";

        const name = document.createElement("h5");
        name.textContent = item.name || "Anonymous";
        comment.appendChild(name);

        const body = document.createElement("p");
        body.textContent = item.comment;
        comment.appendChild(body);

        if (item.createdAt) {
            const time = document.createElement("time");
            time.textContent = new Date(item.createdAt).toLocaleString();
            comment.appendChild(time);
        }

        list.appendChild(comment);
    });
}

async function getComments(segmentId) {
    if (state.commentsCache[segmentId]) {
        return state.commentsCache[segmentId];
    }

    const fallback = readLocalComments(segmentId);

    if (!GOOGLE_SCRIPT_URL || USE_LOCAL_FALLBACK_ONLY) {
        state.commentsCache[segmentId] = fallback;
        return fallback;
    }

    try {
        const url = new URL(GOOGLE_SCRIPT_URL);
        url.searchParams.set("segmentId", segmentId);
        const response = await fetch(url.toString(), {
            method: "GET",
            headers: { Accept: "application/json" },
            mode: "cors"
        });

        if (!response.ok) {
            throw new Error(`Failed to load comments: ${response.status}`);
        }

        const payload = await response.json();
        const items = Array.isArray(payload?.comments) ? payload.comments : [];
        state.commentsCache[segmentId] = items;
        writeLocalComments(segmentId, items);
        return items;
    } catch (error) {
        console.error(error);
        state.commentsCache[segmentId] = fallback;
        return fallback;
    }
}

async function saveComment(entry) {
    const newRecord = {
        name: entry.name,
        comment: entry.comment,
        segmentId: entry.segmentId,
        segmentType: entry.segmentType,
        createdAt: new Date().toISOString()
    };

    const local = readLocalComments(entry.segmentId);
    local.push(newRecord);
    writeLocalComments(entry.segmentId, local);
    state.commentsCache[entry.segmentId] = local;

    if (!GOOGLE_SCRIPT_URL || USE_LOCAL_FALLBACK_ONLY) {
        return;
    }

    const response = await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        mode: "cors",
        body: JSON.stringify(newRecord)
    });

    if (!response.ok) {
        throw new Error(`Failed to save comment: ${response.status}`);
    }

    const payload = await response.json();
    if (!payload?.success) {
        throw new Error("Google Apps Script did not return success");
    }
}

function readLocalComments(segmentId) {
    try {
        const raw = localStorage.getItem(localStorageKey(segmentId));
        return raw ? JSON.parse(raw) : [];
    } catch (error) {
        console.error(error);
        return [];
    }
}

function writeLocalComments(segmentId, comments) {
    try {
        localStorage.setItem(localStorageKey(segmentId), JSON.stringify(comments));
    } catch (error) {
        console.error(error);
    }
}

function localStorageKey(segmentId) {
    return `comments::${segmentId}`;
}

function setStatus(message, isError = false) {
    const status = document.querySelector("[data-comment-status]");
    if (!status) return;
    status.textContent = message;
    status.classList.toggle("comment-panel__status--error", isError);
}
