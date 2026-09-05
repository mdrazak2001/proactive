interface LiveViewPaneProps {
  url: string;
}

export default function LiveViewPane({ url }: LiveViewPaneProps) {
  return (
    <iframe
      className="computer-live-view"
      title="Browserbase live view"
      src={url}
      sandbox="allow-same-origin allow-scripts"
      allow="clipboard-read; clipboard-write"
      referrerPolicy="no-referrer"
    />
  );
}
