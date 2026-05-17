import { NextResponse } from "next/server";
import axios from "axios";
import * as cheerio from "cheerio";

// ============================================================
//  Common browser headers
// ============================================================
const HEADERS = {
    "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
};

// ============================================================
//  Engine definitions
// ============================================================
const SCRAPERS = {
    duckduckgo: {
        url: (q) =>
            `https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`,
        parse: (data, query) => {
            if (!data) return [];
            let text = data.AbstractText || data.Answer || "";
            if (!text && data.RelatedTopics) {
                text = data.RelatedTopics
                    .filter((r) => typeof r === "object" && r.Text)
                    .map((r) => r.Text)
                    .join(" | ")
                    .slice(0, 400);
            }
            if (!text) return [];
            return [
                {
                    title: data.Heading || query,
                    link:
                        data.AbstractURL ||
                        `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
                    snippet: text.slice(0, 600),
                },
            ];
        },
    },
    yahoo: {
        url: (q) => `https://search.yahoo.com/search?p=${encodeURIComponent(q)}`,
        parse: ($) => {
            const results = [];
            $("div.algo, ol.searchCenterMiddle li").each((_, el) => {
                const title = $(el).find("h3").text().trim();
                const link = $(el).find("a").first().attr("href");
                const snippet =
                    $(el).find("p").text().trim() || $(el).find(".compText").text().trim();
                if (title && link) results.push({ title, link, snippet: snippet || "" });
            });
            return results;
        },
    },
    wikipedia: {
        url: (q) =>
            `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&format=json`,
        parse: (data) => {
            const search = data.query?.search || [];
            return search.map((item) => ({
                title: item.title,
                link: `https://en.wikipedia.org/wiki/${encodeURIComponent(
                    item.title.replace(/ /g, "_")
                )}`,
                snippet: (item.snippet || "").replace(/<\/?[^>]+(>|$)/g, ""),
            }));
        },
    },
    wikidata: {
        url: (q) =>
            `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=en&format=json&limit=10`,
        parse: (data) => {
            if (!data?.search) return [];
            return data.search.map((item) => ({
                title: item.label || item.id,
                link: item.concepturi || `https://www.wikidata.org/wiki/${item.id}`,
                snippet:
                    (item.description || "") +
                    (item.aliases ? " | Aliases: " + item.aliases.join(", ") : ""),
            }));
        },
    },
    searchlify: {
        url: (q) =>
            `https://web-crawl-indexer--xygamer179.replit.app/api/search?q=${encodeURIComponent(q)}&page=1`,
        parse: (data) => {
            if (!data?.results) return [];
            return data.results.slice(0, 20).map((item) => ({
                title: item.title || "",
                link: item.url || "",
                snippet: item.snippet || item.description || "",
                domain: item.domain || "",
                rank: item.rank || 0,
                favicon: item.favicon || "",
            }));
        },
    },
    scholar: {
        url: (q) =>
            `https://scholar.google.com/scholar?q=${encodeURIComponent(q)}&hl=en`,
        parse: ($) => {
            const results = [];
            $(".gs_r.gs_or.gs_scl").each((_, el) => {
                const titleEl = $(el).find(".gs_rt");
                const title = titleEl.text().trim();
                const link = titleEl.find("a").attr("href") || "";
                const snippet = $(el).find(".gs_rs").text().trim();
                if (title) results.push({ title, link, snippet });
            });
            return results;
        },
    },
};

export async function POST(request) {
    try {
        const { query, engine } = await request.json();

        if (!query) {
            return NextResponse.json({ error: "Missing query" }, { status: 400 });
        }
        if (!SCRAPERS[engine]) {
            return NextResponse.json({
                error: "Invalid engine",
                validEngines: Object.keys(SCRAPERS),
            }, { status: 400 });
        }

        console.log(`🔍 Searching ${engine} for: "${query}"`);

        const url = SCRAPERS[engine].url(query);
        let results = [];

        console.log(`  ↳ Fetching: ${url}`);
        const resp = await axios.get(url, {
            headers: HEADERS,
            timeout: 12000,
        });

        // JSON engines (no HTML parsing)
        if (engine === "duckduckgo") {
            results = SCRAPERS.duckduckgo.parse(resp.data, query);
        } else if (["wikipedia", "wikidata", "searchlify"].includes(engine)) {
            results = SCRAPERS[engine].parse(resp.data);
        } else {
            // HTML parsers (yahoo, scholar)
            const $ = cheerio.load(resp.data);
            results = SCRAPERS[engine].parse($);
        }

        console.log(`✅ Returning ${results.length} results`);
        return NextResponse.json({ engine, query, results: results.slice(0, 10) });
    } catch (err) {
        console.error(`❌ Search error:`, err.message);
        return NextResponse.json({
            error: "Search failed",
            detail: err.message,
        }, { status: 500 });
    }
}
