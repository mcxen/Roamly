import React from 'react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      error: null
    };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Roamly render failed', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100vh',
          padding: '32px',
          background: '#f5f2ea',
          color: '#231b16',
          fontFamily: "'Source Han Sans CN', 'Noto Sans CJK SC', 'PingFang SC', sans-serif"
        }}
        >
          <h1 style={{ margin: '0 0 12px', fontSize: '24px' }}>Roamly 启动失败</h1>
          <p style={{ margin: '0 0 12px', lineHeight: 1.6 }}>
            前端发生运行时错误，页面未能正常渲染。请打开浏览器控制台查看详细报错。
          </p>
          <pre style={{
            margin: 0,
            padding: '16px',
            overflow: 'auto',
            borderRadius: '8px',
            background: '#fff',
            border: '1px solid #ddd3c4',
            whiteSpace: 'pre-wrap'
          }}
          >
            {String(this.state.error?.stack || this.state.error?.message || this.state.error || 'Unknown error')}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
