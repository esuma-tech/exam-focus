import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store'
import Layout from './components/Layout'
import { FullSpinner } from './components/ui'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Courses from './pages/courses/CourseList'
import CourseDetail from './pages/courses/CourseDetail'
import LearnerDashboard from './pages/dashboards/LearnerDashboard'
import CoursePlayer from './pages/learn/CoursePlayer'
import QuizTake from './pages/learn/QuizTake'
import MyCourses from './pages/learn/MyCourses'
import LiveClasses from './pages/learn/LiveClasses'
import InstructorDashboard from './pages/dashboards/InstructorDashboard'
import CourseBuilder from './pages/instructor/CourseBuilder'
import AdminDashboard from './pages/dashboards/AdminDashboard'
import AdminUsers from './pages/admin/AdminUsers'
import Notifications from './pages/Notifications'

function Protected({ roles = [], children }) {
  const { user, loading } = useAuth()
  if (loading) return <FullSpinner />
  if (!user) return <Navigate to="/login" replace />
  if (roles.length && !roles.includes(user.role)) {
    return <Navigate to={homeFor(user.role)} replace />
  }
  return children
}

function homeFor(role) {
  return { learner: '/learn', instructor: '/instructor', admin: '/admin', parent: '/learn' }[role]
}

export default function App() {
  const { user } = useAuth()
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Landing />} />
        <Route path="courses" element={<Courses />} />
        <Route path="courses/:id" element={<CourseDetail />} />
        <Route path="login" element={user ? <Navigate to={homeFor(user.role)} replace /> : <Login />} />
        <Route path="register" element={user ? <Navigate to={homeFor(user.role)} replace /> : <Register />} />

        {/* Learner & parent */}
        <Route path="learn" element={<Protected roles={['learner', 'parent']}><LearnerDashboard /></Protected>} />
        <Route path="learn/courses" element={<Protected roles={['learner', 'parent']}><MyCourses /></Protected>} />
        <Route path="learn/courses/:id" element={<Protected roles={['learner', 'parent']}><CoursePlayer /></Protected>} />
        <Route path="learn/courses/:courseId/quiz/:quizId" element={<Protected roles={['learner', 'parent']}><QuizTake /></Protected>} />
        <Route path="learn/live" element={<Protected roles={['learner', 'parent']}><LiveClasses /></Protected>} />

        {/* Instructor */}
        <Route path="instructor" element={<Protected roles={['instructor', 'admin']}><InstructorDashboard /></Protected>} />
        <Route path="instructor/courses" element={<Protected roles={['instructor', 'admin']}><CourseBuilder /></Protected>} />
        <Route path="instructor/courses/:id" element={<Protected roles={['instructor', 'admin']}><CourseBuilder /></Protected>} />

        {/* Admin */}
        <Route path="admin" element={<Protected roles={['admin']}><AdminDashboard /></Protected>} />
        <Route path="admin/users" element={<Protected roles={['admin']}><AdminUsers /></Protected>} />

        <Route path="notifications" element={<Protected><Notifications /></Protected>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}