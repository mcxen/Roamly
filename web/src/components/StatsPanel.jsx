import { useEffect, useState } from 'react';
import { api } from '../api.js';
import {
  BarChart3, Globe, Heart, Map, MapPin, ScanLine, Sparkles,
  Layers, Camera, FileJson
} from 'lucide-react';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { StatCard, BarChart, DonutChart, ProgressBar, ColorScaleBar } from './ui/chart';

const BAND_COLORS = {
  red: '#ef4444', orange: '#f97316', yellow: '#eab308',
  green: '#22c55e', cyan: '#06b6d4', blue: '#3b82f6', purple: '#a855f7', '未设置': '#94a3b8'
};

export default function StatsPanel() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.stats().then(setStats).catch(() => {});
  }, []);

  if (!stats) {
    return (
      <div className="tw-flex tw-items-center tw-justify-center tw-py-16 tw-text-[var(--kumo-muted)]">
        加载统计数据...
      </div>
    );
  }

  const pct = (n) => stats.total ? Math.round((n / stats.total) * 100) : 0;

  return (
    <div className="tw-space-y-5 tw-p-4 tw-animate-[kumo-fade-in_0.2s_ease]">
      {/* Stats Cards Grid */}
      <div className="tw-grid tw-grid-cols-2 sm:tw-grid-cols-3 lg:tw-grid-cols-6 tw-gap-3">
        <StatCard label="地图总数" value={stats.total} icon={<Map size={16} />} variant="brand" />
        <StatCard label="已收藏" value={stats.favorites} icon={<Heart size={16} />} variant="brand" />
        <StatCard label="OCR已识别" value={`${stats.withOcr} (${pct(stats.withOcr)}%)`} icon={<ScanLine size={16} />} variant="success" />
        <StatCard label="有坐标" value={`${stats.withCoords} (${pct(stats.withCoords)}%)`} icon={<MapPin size={16} />} variant="brand" />
        <StatCard label="有边界" value={`${stats.withBounds} (${pct(stats.withBounds)}%)`} icon={<Globe size={16} />} variant="warning" />
        <StatCard label="AI已分析" value={`${stats.withAI} (${pct(stats.withAI)}%)`} icon={<Sparkles size={16} />} variant="success" />
      </div>

      <div className="tw-grid tw-grid-cols-1 lg:tw-grid-cols-3 tw-gap-4">
        {/* Data Quality Overview */}
        <Card>
          <Card.Header>
            <Card.Title>数据完整度</Card.Title>
            <Card.Description>各维度覆盖率概览</Card.Description>
          </Card.Header>
          <Card.Content className="tw-space-y-3">
            <ProgressBar value={stats.withOcr} max={stats.total} label="OCR识别" color="var(--kumo-info)" />
            <ProgressBar value={stats.withCoords} max={stats.total} label="经纬度坐标" color="var(--kumo-brand)" />
            <ProgressBar value={stats.withBounds} max={stats.total} label="地理边界" color="var(--kumo-warning)" />
            <ProgressBar value={stats.withAI} max={stats.total} label="AI分析覆盖" color="var(--kumo-success)" />
            <ProgressBar value={stats.favorites} max={stats.total} label="收藏率" color="#ec4899" />
          </Card.Content>
        </Card>

        {/* Storage Bands */}
        <Card>
          <Card.Header>
            <Card.Title>彩虹存储分布</Card.Title>
            <Card.Description>按存储色带分类的地图数量</Card.Description>
          </Card.Header>
          <Card.Content className="tw-space-y-3">
            <ColorScaleBar
              segments={(stats.storageBands || []).map((item) => ({
                value: item.count,
                color: BAND_COLORS[item.band] || '#94a3b8',
                label: item.band || '未设置',
              }))}
            />
            {(stats.storageBands || []).length > 0 && (
              <BarChart
                data={(stats.storageBands || []).map((item, i) => ({
                  label: item.band || '未设置',
                  value: item.count,
                  color: BAND_COLORS[item.band] || '#94a3b8',
                }))}
                size="sm"
                showValues
              />
            )}
          </Card.Content>
        </Card>

        {/* Top Countries Donut */}
        <Card>
          <Card.Header>
            <Card.Title>国家分布 Top 10</Card.Title>
            <Card.Description>地图来源国家的数量分布</Card.Description>
          </Card.Header>
          <Card.Content>
            {(stats.countries || []).length > 0 ? (
              <DonutChart
                data={(stats.countries || []).map((item, i) => ({
                  label: item.name || '未设置',
                  value: item.count,
                }))}
                size="sm"
                showLegend
              />
            ) : (
              <div className="tw-text-xs tw-text-[var(--kumo-muted)] tw-py-4 tw-text-center">暂无国家数据</div>
            )}
          </Card.Content>
        </Card>
      </div>

      {/* Decades Distribution */}
      {stats.decades?.length > 0 && (
        <Card>
          <Card.Header>
            <Card.Title>年代分布</Card.Title>
            <Card.Description>地图覆盖的时间年代统计</Card.Description>
          </Card.Header>
          <Card.Content>
            <BarChart
              data={(stats.decades || []).map((item) => ({
                label: item.decade,
                value: item.count,
              }))}
              size="base"
              showValues
            />
          </Card.Content>
        </Card>
      )}

      {/* Quick Actions */}
      <Card variant="recessed">
        <Card.Header>
          <Card.Title>快捷操作</Card.Title>
        </Card.Header>
        <Card.Content className="tw-flex tw-flex-wrap tw-gap-2">
          <Badge variant="info" size="sm">
            <Layers size={12} className="tw-mr-1" />
            GeoJSON 导出
          </Badge>
          <Badge variant="info" size="sm">
            <Camera size={12} className="tw-mr-1" />
            拍照导入
          </Badge>
          <Badge variant="outline" size="sm">
            <FileJson size={12} className="tw-mr-1" />
            EXIF 位置提取
          </Badge>
        </Card.Content>
      </Card>
    </div>
  );
}
