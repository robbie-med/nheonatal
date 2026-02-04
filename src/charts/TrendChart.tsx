import { useEffect, useRef } from 'react';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { Snapshot } from '../types';

// Register Chart.js components
Chart.register(...registerables);

interface TrendChartProps {
  snapshots: Snapshot[];
  height?: number;
}

export function TrendChart({ snapshots, height = 300 }: TrendChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (!canvasRef.current || snapshots.length === 0) return;

    // Destroy previous chart
    if (chartRef.current) {
      chartRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Prepare data
    const labels = snapshots.map(s => {
      const d = new Date(s.timestamp);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    });

    const eosData = snapshots.map(s => s.outputs.eos?.riskPosterior ?? null);
    const tsbData = snapshots.map(s => s.outputs.bili ? s.inputs.bili.tsbValue : null);
    const photoData = snapshots.map(s => s.outputs.bili?.photoThreshold ?? null);

    // Get theme colors
    const computedStyle = getComputedStyle(document.documentElement);
    const textColor = computedStyle.getPropertyValue('--text-primary').trim() || '#333';
    const gridColor = computedStyle.getPropertyValue('--border-color').trim() || '#ddd';

    const config: ChartConfiguration = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'EOS Risk (/1000)',
            data: eosData,
            borderColor: '#e74c3c',
            backgroundColor: 'rgba(231, 76, 60, 0.1)',
            yAxisID: 'y-eos',
            tension: 0.1,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'TSB (mg/dL)',
            data: tsbData,
            borderColor: '#f39c12',
            backgroundColor: 'rgba(243, 156, 18, 0.1)',
            yAxisID: 'y-bili',
            tension: 0.1,
            pointRadius: 4,
            pointHoverRadius: 6
          },
          {
            label: 'Photo Threshold',
            data: photoData,
            borderColor: '#3498db',
            borderDash: [5, 5],
            backgroundColor: 'transparent',
            yAxisID: 'y-bili',
            tension: 0.1,
            pointRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: textColor,
              usePointStyle: true,
              padding: 15
            }
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 13 },
            bodyFont: { size: 12 }
          }
        },
        scales: {
          x: {
            ticks: {
              color: textColor,
              maxRotation: 45,
              minRotation: 45
            },
            grid: {
              color: gridColor
            }
          },
          'y-eos': {
            type: 'linear',
            position: 'left',
            title: {
              display: true,
              text: 'EOS Risk (/1000)',
              color: textColor
            },
            ticks: {
              color: textColor
            },
            grid: {
              color: gridColor
            },
            min: 0
          },
          'y-bili': {
            type: 'linear',
            position: 'right',
            title: {
              display: true,
              text: 'Bilirubin (mg/dL)',
              color: textColor
            },
            ticks: {
              color: textColor
            },
            grid: {
              drawOnChartArea: false
            },
            min: 0
          }
        }
      }
    };

    chartRef.current = new Chart(ctx, config);

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [snapshots]);

  // Update chart when theme changes
  useEffect(() => {
    const observer = new MutationObserver(() => {
      if (chartRef.current) {
        chartRef.current.update();
      }
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });

    return () => observer.disconnect();
  }, []);

  if (snapshots.length === 0) {
    return (
      <div className="chart-empty" style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)' }}>No snapshots to display. Save a snapshot to see trends.</p>
      </div>
    );
  }

  return (
    <div className="chart-container" style={{ height }}>
      <canvas ref={canvasRef}></canvas>
    </div>
  );
}
