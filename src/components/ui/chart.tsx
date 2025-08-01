"use client"

import * as React from "react"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Label, Pie, PieChart } from "recharts"

export function Component() {
  const [activeChart, setActiveChart] = React.useState<string>("visitors")

  const data = [
    { name: "Visitors", value: 275, color: "hsl(var(--chart-1))" },
    { name: "Customers", value: 200, color: "hsl(var(--chart-2))" },
    { name: "Pageviews", value: 287, color: "hsl(var(--chart-3))" },
    { name: "Orders", value: 190, color: "hsl(var(--chart-4))" },
  ]

  const total = React.useMemo(() => data.reduce((acc, curr) => acc + curr.value, 0), [])

  return (
    <ChartContainer
      config={{
        visitors: {
          label: "Visitors",
          color: "hsl(var(--chart-1))",
        },
        customers: {
          label: "Customers",
          color: "hsl(var(--chart-2))",
        },
        pageviews: {
          label: "Pageviews",
          color: "hsl(var(--chart-3))",
        },
        orders: {
          label: "Orders",
          color: "hsl(var(--chart-4))",
        },
      }}
      className="aspect-square h-[250px]"
    >
      <PieChart>
        <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={60}
          strokeWidth={5}
          activeIndex={data.findIndex((item) => item.name.toLowerCase() === activeChart)}
          activeShape={({
            outerRadius = 0,
            ...props
          }: {
            outerRadius: number
          }) => (
            <g>
              <circle
                cx={props.cx}
                cy={props.cy}
                r={outerRadius + 10}
                fill={props.fill}
                stroke={props.stroke}
                strokeWidth={props.strokeWidth}
              />
              <text
                x={props.cx}
                y={props.cy}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="black"
                fontSize="24px"
                fontWeight="bold"
              >
                {props.payload.value}
              </text>
            </g>
          )}
        >
          <Label
            content={({ viewBox }) => {
              if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                return (
                  <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                    <tspan x={viewBox.cx} y={viewBox.cy} className="fill-foreground text-3xl font-bold">
                      {total.toLocaleString()}
                    </tspan>
                    <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 24} className="fill-muted-foreground">
                      Total
                    </tspan>
                  </text>
                )
              }
            }}
          />
        </Pie>
      </PieChart>
    </ChartContainer>
  )
}
