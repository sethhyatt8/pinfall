import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { CourseHome } from './components/CourseHome.tsx'
import { CourseList } from './components/CourseList.tsx'
import { DataPort } from './components/DataPort.tsx'
import { HoleView } from './components/HoleView.tsx'
import { Scorecard } from './components/Scorecard.tsx'
import { ThrowTool } from './components/ThrowTool.tsx'
import { StoreProvider } from './context/Store.tsx'

export default function App() {
  return (
    <ErrorBoundary>
      <StoreProvider>
        <HashRouter>
          <Routes>
            <Route path="/" element={<CourseList />} />
            <Route path="/c/:courseId" element={<CourseHome />} />
            <Route path="/c/:courseId/h/:hole" element={<HoleView />} />
            <Route path="/c/:courseId/card" element={<Scorecard />} />
            <Route path="/c/:courseId/throw" element={<ThrowTool />} />
            <Route path="/data" element={<DataPort />} />
            <Route path="*" element={<CourseList />} />
          </Routes>
        </HashRouter>
      </StoreProvider>
    </ErrorBoundary>
  )
}

class ErrorBoundary extends Component<{ children: ReactNode }, { message: string | null }> {
  state = { message: null as string | null }

  static getDerivedStateFromError(error: unknown): { message: string } {
    return { message: error instanceof Error ? error.message : 'Something broke on this page.' }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (this.state.message) {
      return (
        <div className="splash">
          <p className="brand">
            Pin<span>fall</span>
          </p>
          <p>{this.state.message}</p>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
