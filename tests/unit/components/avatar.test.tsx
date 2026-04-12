import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean }) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    const { fill: _fill, ...rest } = props;
    return <img {...rest} />;
  },
}));

import { Avatar } from "@/components/ui/Avatar";

describe("Avatar", () => {
  it("muestra iniciales cuando no hay src", () => {
    render(<Avatar initials="JD" />);
    expect(screen.getByText("JD")).toBeInTheDocument();
  });

  it("aplica backgroundColor del prop color", () => {
    render(<Avatar initials="JD" color="#123456" />);
    const avatar = screen.getByText("JD").closest("div");
    expect(avatar).toHaveStyle({ backgroundColor: "#123456" });
  });

  it("usa color por defecto #E82020 cuando no se pasa color", () => {
    render(<Avatar initials="AB" />);
    const avatar = screen.getByText("AB").closest("div");
    expect(avatar).toHaveStyle({ backgroundColor: "#E82020" });
  });

  it("renderiza image cuando hay src", () => {
    render(<Avatar initials="JD" src="https://example.com/avatar.jpg" />);
    const img = screen.getByRole("img");
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute("src", "https://example.com/avatar.jpg");
  });

  it("no muestra iniciales cuando hay src", () => {
    render(<Avatar initials="JD" src="https://example.com/avatar.jpg" />);
    expect(screen.queryByText("JD")).not.toBeInTheDocument();
  });
});
