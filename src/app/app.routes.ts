import { Routes } from '@angular/router';
import { VideoUploadComponent } from './components/video-upload/video-upload.component';
import { VideoListComponent } from './components/video-list/video-list.component';
import { RegisterComponent } from './pages/register/register.component';
import { LoginComponent } from './pages/login/login.component';
import { ActivateComponent } from './pages/activate/activate.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { VideoDetailComponent } from './pages/video-detail/video-detail.component';
import { AuthGuardService } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: '/videos', pathMatch: 'full' },
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: 'activate', component: ActivateComponent },
  { path: 'dashboard', component: DashboardComponent, canActivate: [AuthGuardService] },
  { path: 'videos', component: VideoListComponent },
  { path: 'videos/:id', component: VideoDetailComponent },
  { path: 'upload', component: VideoUploadComponent }
];
