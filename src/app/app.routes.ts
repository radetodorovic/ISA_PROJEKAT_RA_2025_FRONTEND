import { Routes } from '@angular/router';
import { VideoUploadComponent } from './components/video-upload/video-upload.component';
import { VideoListComponent } from './components/video-list/video-list.component';

export const routes: Routes = [
  { path: '', redirectTo: '/videos', pathMatch: 'full' },
  { path: 'videos', component: VideoListComponent },
  { path: 'upload', component: VideoUploadComponent }
];
