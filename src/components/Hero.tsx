import React from "react";

export default function Hero() {
  return (
    <section className="asus-rog-card mb-6">
      <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
        Enzo <span className="text-[var(--accent)]">Oriol</span>
      </h1>
      <p className="text-lg mt-3 text-[var(--muted)]">
        Étudiant IPSSI · Dév Odoo 18 · Full‑stack & Cyber · Lyon / Sud
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a href="/projects" className="asus-rog-card inline-block">Projets</a>
        <a href="/resume" className="asus-rog-card inline-block">CV</a>
        <a href="/contact" className="asus-rog-card inline-block">Contact</a>
      </div>
    </section>
  );
}
