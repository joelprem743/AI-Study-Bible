import express from "express";
import fetch from "node-fetch";

export function createBibleProxy() {
    const app = express();

    app.get("/api/bible", async (req, res) => {
        try {
            const target = req.query.url;
            if (!target) {
                return res.status(400).json({ error: "Missing url parameter" });
            }

            const response = await fetch(target);
            const text = await response.text();

            res.setHeader("Access-Control-Allow-Origin", "*");
            res.send(text);
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    return app;
}
