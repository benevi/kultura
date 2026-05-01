import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import type { StreamingProvider } from "@/types/media";
import { StreamingProviders } from "@/components/media/StreamingProviders";

const flatrateProviders: StreamingProvider[] = [
  { name: "Netflix", logoPath: "https://image.tmdb.org/t/p/original/netflix.png", type: "flatrate" },
  { name: "Disney+", logoPath: "https://image.tmdb.org/t/p/original/disney.png", type: "flatrate" },
];

const rentProviders: StreamingProvider[] = [
  { name: "Amazon Video", logoPath: "https://image.tmdb.org/t/p/original/amazon.png", type: "rent" },
];

const buyProviders: StreamingProvider[] = [
  { name: "Apple TV", logoPath: "https://image.tmdb.org/t/p/original/apple.png", type: "buy" },
];

describe("StreamingProviders", () => {
  it("renderiza los logos de providers flatrate", () => {
    render(<StreamingProviders providers={flatrateProviders} title="Dónde ver" />);
    expect(screen.getByAltText("Netflix")).toBeInTheDocument();
    expect(screen.getByAltText("Disney+")).toBeInTheDocument();
  });

  it("retorna null y no renderiza nada cuando no hay providers", () => {
    const { container } = render(
      <StreamingProviders providers={[]} title="Dónde ver" />
    );
    expect(container.firstChild).toBeNull();
  });

  it("muestra el nombre de cada provider", () => {
    render(<StreamingProviders providers={flatrateProviders} title="Dónde ver" />);
    expect(screen.getByText("Netflix")).toBeInTheDocument();
    expect(screen.getByText("Disney+")).toBeInTheDocument();
  });

  it("prioriza flatrate sobre rent", () => {
    const mixed: StreamingProvider[] = [...flatrateProviders, ...rentProviders];
    render(<StreamingProviders providers={mixed} title="Dónde ver" />);
    // flatrate se muestra
    expect(screen.getByAltText("Netflix")).toBeInTheDocument();
    // rent NO se muestra cuando hay flatrate
    expect(screen.queryByAltText("Amazon Video")).not.toBeInTheDocument();
  });

  it("muestra rent cuando no hay flatrate", () => {
    render(<StreamingProviders providers={rentProviders} title="Dónde ver" />);
    expect(screen.getByAltText("Amazon Video")).toBeInTheDocument();
  });

  it("muestra buy cuando no hay flatrate ni rent", () => {
    render(<StreamingProviders providers={buyProviders} title="Dónde ver" />);
    expect(screen.getByAltText("Apple TV")).toBeInTheDocument();
  });

  it("elimina duplicados por nombre", () => {
    const withDups: StreamingProvider[] = [
      { name: "Netflix", logoPath: "https://image.tmdb.org/t/p/original/n1.png", type: "flatrate" },
      { name: "Netflix", logoPath: "https://image.tmdb.org/t/p/original/n2.png", type: "flatrate" },
    ];
    render(<StreamingProviders providers={withDups} title="Dónde ver" />);
    const logos = screen.getAllByAltText("Netflix");
    expect(logos).toHaveLength(1);
  });

  it("muestra el título de la sección", () => {
    render(<StreamingProviders providers={flatrateProviders} title="Dónde ver" />);
    expect(screen.getByText("Dónde ver")).toBeInTheDocument();
  });
});
