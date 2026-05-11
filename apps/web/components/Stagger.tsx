'use client';

import { motion, type Variants } from "framer-motion";
import type { CSSProperties, ReactNode } from "react";

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.05, delayChildren: 0.04 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 240, damping: 24 },
  },
};

type StaggerAs = 'div' | 'ul' | 'ol' | 'section';
type StaggerItemAs = 'div' | 'li' | 'article';

type StaggerProps = {
  as?: StaggerAs;
  children: ReactNode;
  amount?: number;
  once?: boolean;
  className?: string;
  style?: CSSProperties;
};

export function Stagger({ as = "div", children, amount = 0.2, once = true, className, style }: StaggerProps) {
  const props = {
    initial: "hidden" as const,
    whileInView: "show" as const,
    viewport: { once, amount },
    variants: containerVariants,
    className,
    style,
  };
  switch (as) {
    case 'ul': return <motion.ul {...props}>{children}</motion.ul>;
    case 'ol': return <motion.ol {...props}>{children}</motion.ol>;
    case 'section': return <motion.section {...props}>{children}</motion.section>;
    default: return <motion.div {...props}>{children}</motion.div>;
  }
}

type StaggerItemProps = {
  as?: StaggerItemAs;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
};

export function StaggerItem({ as = "div", children, className, style, onClick }: StaggerItemProps) {
  const props = { variants: itemVariants, className, style, onClick };
  switch (as) {
    case 'li': return <motion.li {...props}>{children}</motion.li>;
    case 'article': return <motion.article {...props}>{children}</motion.article>;
    default: return <motion.div {...props}>{children}</motion.div>;
  }
}

export { containerVariants as staggerContainerVariants, itemVariants as staggerItemVariants };
