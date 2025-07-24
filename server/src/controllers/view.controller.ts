import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AssetResponseDto } from 'src/dtos/asset-response.dto';
import { AuthDto } from 'src/dtos/auth.dto';
import { Auth, Authenticated } from 'src/middleware/auth.guard';
import { ViewService } from 'src/services/view.service';
import { FolderStatsResponseDto } from 'src/dtos/folder-stats.dto';

@ApiTags('View')
@Controller('view')
export class ViewController {
  constructor(private service: ViewService) {}

  @Get('folder/unique-paths')
  @Authenticated()
  getUniqueOriginalPaths(@Auth() auth: AuthDto): Promise<string[]> {
    return this.service.getUniqueOriginalPaths(auth);
  }

  @Get('folder')
  @Authenticated()
  getAssetsByOriginalPath(@Auth() auth: AuthDto, @Query('path') path: string): Promise<AssetResponseDto[]> {
    return this.service.getAssetsByOriginalPath(auth, path);
  }

  @Get('folder/stats')
  @Authenticated()
  getFolderStats(@Auth() auth: AuthDto, @Query('path') path: string): Promise<FolderStatsResponseDto[]> {
    return this.service.getFolderStats(auth, path);
  }
}
