'use client';

import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { ChartContainer } from './chart-container';
import { AlphaTooltip } from './alpha-tooltip';
import {
  RESOURCE_COLORS,
  AXIS_STYLE,
  GRID_STYLE,
  CHART_MARGINS,
  LEGEND_CONFIG,
  ANIMATION_CONFIG,
  RESOLVED_COLORS,
  formatters,
} from '@/lib/chart-config';
import { cn } from '@/lib/utils';

interface ResourceTypeData {
  type: string;
  size: number;
  count: number;
}

interface ResourceDomainData {
  domain: string;
  js: number;
  css: number;
  images: number;
  fonts: number;
  other?: number;
}

interface ResourceBreakdownProps {
  typeData: ResourceTypeData[];
  domainData?: ResourceDomainData[];
  height?: number;
  className?: string;
}

const TYPE_COLOR_MAP: Record<string, string> = {
  js: RESOURCE_COLORS.js,
  javascript: RESOURCE_COLORS.js,
  css: RESOURCE_COLORS.css,
  images: RESOURCE_COLORS.images,
  image: RESOURCE_COLORS.images,
  img: RESOURCE_COLORS.images,
  fonts: RESOURCE_COLORS.fonts,
  font: RESOURCE_COLORS.fonts,
  xhr: RESOURCE_COLORS.xhr,
  other: RESOURCE_COLORS.other,
};

function getTypeColor(type: string | undefined | null): string {
  return TYPE_COLOR_MAP[(type ?? 'other').toLowerCase()] ?? RESOLVED_COLORS.chrome;
}

export function ResourceBreakdown({
  typeData,
  domainData,
  height = 280,
  className,
}: ResourceBreakdownProps) {
  const totalSize = typeData.reduce((sum, d) => sum + d.size, 0);

  return (
    <div className={cn('w-full grid gap-4', domainData ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1', className)}>
      {/* Donut — by type */}
      <div>
        <ChartContainer height={height}>
          <PieChart>
            <Pie
              data={typeData}
              dataKey="size"
              nameKey="type"
              cx="50%"
              cy="50%"
              innerRadius="60%"
              outerRadius="100%"
              paddingAngle={2}
              {...ANIMATION_CONFIG.pieAnimation}
            >
              {typeData.map((entry) => (
                <Cell key={entry.type} fill={getTypeColor(entry.type)} />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0]!.payload as ResourceTypeData;
                return (
                  <div className="bg-gs-ink text-white rounded-lg px-4 py-3 shadow-lg text-xs">
                    <div className="font-system font-bold text-sm mb-1">{d.type}</div>
                    <div className="text-gs-muted">Size: <span className="text-white font-mono">{formatters.bytes(d.size)}</span></div>
                    <div className="text-gs-muted">Files: <span className="text-white font-mono">{d.count}</span></div>
                    <div className="text-gs-muted">Share: <span className="text-white font-mono">{totalSize > 0 ? Math.round((d.size / totalSize) * 100) : 0}%</span></div>
                  </div>
                );
              }}
            />
            <Legend {...LEGEND_CONFIG} />
            {/* Center text */}
            <text
              x="50%"
              y="48%"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-primary"
              fontSize={28}
              fontFamily="var(--font-data)"
              fontWeight={700}
            >
              {formatters.bytes(totalSize)}
            </text>
            <text
              x="50%"
              y="58%"
              textAnchor="middle"
              dominantBaseline="central"
              className="fill-muted"
              fontSize={11}
              fontFamily="var(--font-data)"
            >
              Total Size
            </text>
          </PieChart>
        </ChartContainer>
      </div>

      {/* Stacked Bar — by domain */}
      {domainData && domainData.length > 0 && (
        <div>
          <ChartContainer height={height}>
            <BarChart
              data={domainData.slice(0, 10)}
              layout="vertical"
              margin={CHART_MARGINS.wideLabel}
            >
              <CartesianGrid {...GRID_STYLE} />
              <XAxis
                type="number"
                {...AXIS_STYLE}
                tickFormatter={(v: number) => formatters.bytes(v)}
              />
              <YAxis
                type="category"
                dataKey="domain"
                width={110}
                {...AXIS_STYLE}
                tick={{ ...AXIS_STYLE.tick, fontSize: 10 }}
              />
              <Tooltip content={<AlphaTooltip />} />
              <Legend {...LEGEND_CONFIG} />
              <Bar dataKey="js" name="JS" stackId="stack" fill={RESOURCE_COLORS.js} />
              <Bar dataKey="css" name="CSS" stackId="stack" fill={RESOURCE_COLORS.css} />
              <Bar dataKey="images" name="Images" stackId="stack" fill={RESOURCE_COLORS.images} />
              <Bar dataKey="fonts" name="Fonts" stackId="stack" fill={RESOURCE_COLORS.fonts} />
            </BarChart>
          </ChartContainer>
        </div>
      )}
    </div>
  );
}
