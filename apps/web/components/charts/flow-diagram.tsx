'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { FLOW_NODE_COLORS, OKLCH } from '@/lib/chart-config';

interface FlowNode {
  id: string;
  label: string;
  type: 'source' | 'processor' | 'destination';
  icon?: string | React.ReactNode;
  status?: 'active' | 'inactive' | 'error';
  metadata?: Record<string, string>;
}

interface FlowEdge {
  source: string;
  target: string;
  label?: string;
  animated?: boolean;
}

interface FlowDiagramProps {
  nodes: FlowNode[];
  edges: FlowEdge[];
  direction?: 'horizontal' | 'vertical';
  interactive?: boolean;
  compact?: boolean;
  height?: number;
  className?: string;
}

const NODE_COLORS: Record<FlowNode['type'], string> = {
  source: FLOW_NODE_COLORS['source'] ?? OKLCH.cyan,
  processor: FLOW_NODE_COLORS['warning'] ?? OKLCH.warning,
  destination: OKLCH.black,
};

const STATUS_DOT: Record<string, string> = {
  active: OKLCH.terminal,
  inactive: OKLCH.midLight,
  error: OKLCH.critical,
};

const NODE_W = 140;
const NODE_H = 56;
const H_GAP = 80;
const V_GAP = 40;
const COMPACT_NODE_W = 100;
const COMPACT_NODE_H = 40;

export function FlowDiagram({
  nodes,
  edges,
  direction = 'horizontal',
  interactive = false,
  compact = false,
  height,
  className,
}: FlowDiagramProps) {
  const nw = compact ? COMPACT_NODE_W : NODE_W;
  const nh = compact ? COMPACT_NODE_H : NODE_H;

  // Simple layered layout: group by type → source, processor, destination
  const layers = useMemo(() => {
    const groups: Record<FlowNode['type'], FlowNode[]> = {
      source: [],
      processor: [],
      destination: [],
    };
    for (const n of nodes) {
      groups[n.type]?.push(n);
    }
    return [groups.source, groups.processor, groups.destination].filter(
      (g) => g.length > 0,
    );
  }, [nodes]);

  // Position calculation
  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    const isH = direction === 'horizontal';

    layers.forEach((layer, li) => {
      layer.forEach((node, ni) => {
        if (isH) {
          pos[node.id] = {
            x: li * (nw + H_GAP),
            y: ni * (nh + V_GAP),
          };
        } else {
          pos[node.id] = {
            x: ni * (nw + H_GAP),
            y: li * (nh + V_GAP),
          };
        }
      });
    });
    return pos;
  }, [layers, direction, nw, nh]);

  // Calculate SVG viewBox
  const maxX = Math.max(...Object.values(positions).map((p) => p.x)) + nw;
  const maxY = Math.max(...Object.values(positions).map((p) => p.y)) + nh;
  const svgW = maxX + 20;
  const svgH = maxY + 20;

  return (
    <div
      className={cn('w-full overflow-auto', className)}
      style={{ height: height ?? svgH + 20 }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgW} ${svgH}`}
        role="img"
        aria-label={`Flow diagram with ${nodes.length} nodes and ${edges.length} connections`}
      >
        {/* Layer backgrounds */}
        {layers.map((layer, li) => {
          const layerNodes = layer.map((n) => positions[n.id]).filter((p): p is { x: number; y: number } => p != null);
          if (!layerNodes.length) return null;
          const minY = Math.min(...layerNodes.map((p) => p.y)) - 12;
          const maxLY = Math.max(...layerNodes.map((p) => p.y)) + nh + 12;
          const minX = Math.min(...layerNodes.map((p) => p.x)) - 12;
          const maxLX = Math.max(...layerNodes.map((p) => p.x)) + nw + 12;

          return (
            <rect
              key={`layer-${li}`}
              x={minX}
              y={minY}
              width={maxLX - minX}
              height={maxLY - minY}
              rx={8}
              fill={li % 2 === 0 ? OKLCH.nearWhite : OKLCH.nearWhite}
              stroke={OKLCH.light}
              strokeWidth={1}
            />
          );
        })}

        {/* Edges */}
        {edges.map((edge, i) => {
          const from = positions[edge.source];
          const to = positions[edge.target];
          if (!from || !to) return null;

          const isH = direction === 'horizontal';
          const x1 = isH ? from.x + nw : from.x + nw / 2;
          const y1 = isH ? from.y + nh / 2 : from.y + nh;
          const x2 = isH ? to.x : to.x + nw / 2;
          const y2 = isH ? to.y + nh / 2 : to.y;

          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2;
          const d = isH
            ? `M ${x1} ${y1} C ${midX} ${y1} ${midX} ${y2} ${x2} ${y2}`
            : `M ${x1} ${y1} C ${x1} ${midY} ${x2} ${midY} ${x2} ${y2}`;

          return (
            <g key={`edge-${i}`}>
              <defs>
                <marker
                  id={`arrowhead-${i}`}
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill={OKLCH.midLight} />
                </marker>
              </defs>
              <motion.path
                d={d}
                fill="none"
                stroke={OKLCH.midLight}
                strokeWidth={1.5}
                markerEnd={`url(#arrowhead-${i})`}
                strokeDasharray={edge.animated ? '8 4' : undefined}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
              >
                {edge.animated && (
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-24"
                    dur="1.5s"
                    repeatCount="indefinite"
                  />
                )}
              </motion.path>
              {edge.label && (
                <text
                  x={midX}
                  y={midY - 6}
                  textAnchor="middle"
                  fontSize={10}
                  fill={OKLCH.midLight}
                  fontFamily="var(--font-data)"
                >
                  {edge.label}
                </text>
              )}
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((node, i) => {
          const pos = positions[node.id];
          if (!pos) return null;
          const accentColor = NODE_COLORS[node.type];

          return (
            <motion.g
              key={node.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              style={{ cursor: interactive ? 'pointer' : 'default' }}
            >
              {/* Card */}
              <rect
                x={pos.x}
                y={pos.y}
                width={nw}
                height={nh}
                rx={8}
                fill="white"
                stroke={OKLCH.light}
                strokeWidth={1}
              />
              {/* Left accent */}
              <rect
                x={pos.x}
                y={pos.y}
                width={4}
                height={nh}
                rx={2}
                fill={accentColor}
              />
              {/* Status dot */}
              {node.status && (
                <circle
                  cx={pos.x + nw - 8}
                  cy={pos.y + 8}
                  r={4}
                  fill={STATUS_DOT[node.status] ?? OKLCH.midLight}
                />
              )}
              {/* Label */}
              <text
                x={pos.x + 14}
                y={pos.y + nh / 2 + 4}
                fontSize={compact ? 10 : 12}
                fontFamily="var(--font-data)"
                fontWeight={500}
                fill={OKLCH.black}
              >
                {node.label.length > (compact ? 12 : 18)
                  ? node.label.slice(0, compact ? 12 : 18) + '...'
                  : node.label}
              </text>
            </motion.g>
          );
        })}
      </svg>
    </div>
  );
}
