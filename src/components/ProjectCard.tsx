import React from "react";

type Props = {
  title: string;
  tags: string[];
  description: string;
  link?: string;
  repo?: string;
};

export default function ProjectCard({ title, tags, description, link, repo }: Props) {
  return (
    <article className="asus-rog-card">
      <h3 className="text-xl font-semibold">{title}</h3>
      <p className="text-sm text-[var(--muted)] mt-1">{description}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((t) => (
          <span key={t} className="text-xs px-2 py-1 rounded-full border border-zinc-700">{t}</span>
        ))}
      </div>
      <div className="mt-4 flex gap-4">
        {link && <a href={link} target="_blank" rel="noreferrer">Demo</a>}
        {repo && <a href={repo} target="_blank" rel="noreferrer">Code</a>}
      </div>
    </article>
  );
}
