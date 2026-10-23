import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";

/**
 * React 18 no pinta Server Components async anidados. Esto los resuelve en
 * el árbol (llama a cada componente `async` con sus props y espera) y deja
 * el resto, incluidos los componentes cliente, para que lo pinte RTL.
 */
export async function resolveServer(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map(resolveServer));
  if (!isValidElement(node)) return node;
  const el = node as ReactElement<{ children?: ReactNode }>;
  if (typeof el.type === "function" && el.type.constructor.name === "AsyncFunction") {
    const out = await (el.type as (p: unknown) => Promise<ReactNode>)(el.props);
    return resolveServer(out);
  }
  if (el.props && "children" in el.props) {
    const kids = await Promise.all(Children.toArray(el.props.children).map(resolveServer));
    return cloneElement(el, undefined, ...kids);
  }
  return el;
}
