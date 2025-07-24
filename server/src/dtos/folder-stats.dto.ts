export class FolderStatsResponseDto {
  name!: string;
  path!: string;
  assetCount!: number;
  totalSize!: number;
  lastModified!: Date;
}