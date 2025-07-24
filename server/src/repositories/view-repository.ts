import { ExpressionBuilder, Kysely } from 'kysely';
import { InjectKysely } from 'nestjs-kysely';
import { DummyValue, GenerateSql } from 'src/decorators';
import { FolderStatsResponseDto } from 'src/dtos/folder-stats.dto';
import { AssetVisibility } from 'src/enum';
import { DB } from 'src/schema';
import { asUuid, withExif } from 'src/utils/database';

export class ViewRepository {
  constructor(@InjectKysely() private db: Kysely<DB>) {}

  @GenerateSql({ params: [DummyValue.UUID] })
  async getUniqueOriginalPaths(userId: string) {
    const results = await this.db
      .selectFrom('asset')
      .select((eb: ExpressionBuilder<DB, 'asset'>) =>
        eb.fn<string>('substring', ['asset.originalPath', eb.val('^(.*/)[^/]*$')]).as('directoryPath'),
      )
      .distinct()
      .where('ownerId', '=', asUuid(userId))
      .where('visibility', '=', AssetVisibility.Timeline)
      .where('deletedAt', 'is', null)
      .where('fileCreatedAt', 'is not', null)
      .where('fileModifiedAt', 'is not', null)
      .where('localDateTime', 'is not', null)
      .execute();

    return results.map((row: { directoryPath: string }) => row.directoryPath.replaceAll(/\/$/g, ''));
  }

  @GenerateSql({ params: [DummyValue.UUID, DummyValue.STRING] })
  async getAssetsByOriginalPath(userId: string, partialPath: string) {
    const normalizedPath = partialPath.replaceAll(/\/$/g, '');

    return this.db
      .selectFrom('asset')
      .selectAll('asset')
      .$call(withExif)
      .where('ownerId', '=', asUuid(userId))
      .where('visibility', '=', AssetVisibility.Timeline)
      .where('deletedAt', 'is', null)
      .where('fileCreatedAt', 'is not', null)
      .where('fileModifiedAt', 'is not', null)
      .where('localDateTime', 'is not', null)
      .where('originalPath', 'like', `%${normalizedPath}/%`)
      .where('originalPath', 'not like', `%${normalizedPath}/%/%`)
      .orderBy(
        (eb: ExpressionBuilder<DB, 'asset'>) =>
          eb.fn('regexp_replace', ['asset.originalPath', eb.val('.*/(.+)'), eb.val(String.raw`\1`)]),
        'asc',
      )
      .execute();
  }

  @GenerateSql({ params: [DummyValue.UUID, DummyValue.STRING] })
  async getFolderStats(userId: string, parentPath: string): Promise<FolderStatsResponseDto[]> {
    const normalizedPath = parentPath.replaceAll(/\/$/g, '');
    const pathPrefix = normalizedPath ? `${normalizedPath}/` : '';
    const pathLevel = (normalizedPath.match(/\//g) || []).length + (normalizedPath ? 2 : 1);

    const childrenQuery = this.db
      .selectFrom('asset')
      .select((eb: ExpressionBuilder<DB, 'asset'>) => [
        eb.fn<string>('split_part', ['originalPath', eb.val('/'), eb.val(pathLevel)]).as('folderName'),
        eb.fn.count('asset.id').as('assetCount'),
        eb.fn
          .sum((eb: ExpressionBuilder<DB, 'asset'>) =>
            eb.selectFrom('asset_exif').select('fileSizeInByte').whereRef('asset_exif.assetId', '=', 'asset.id'),
          )
          .as('totalSize'),
        eb.fn.max('asset.fileModifiedAt').as('lastModified'),
      ])
      .where('ownerId', '=', asUuid(userId))
      .where('isVisible', '=', true)
      .where('deletedAt', 'is', null)
      .where('originalPath', 'like', `${pathPrefix}%`)
      .groupBy('folderName')
      .having((eb: ExpressionBuilder<DB, 'asset'>) => eb.cmpr('folderName', '!=', ''))
      .orderBy('folderName', 'asc');

    const parentStatsQuery = this.db
      .selectFrom('asset')
      .select((eb: ExpressionBuilder<DB, 'asset'>) => [
        eb.fn.count('asset.id').as('assetCount'),
        eb.fn
          .sum((eb: ExpressionBuilder<DB, 'asset'>) =>
            eb.selectFrom('asset_exif').select('fileSizeInByte').whereRef('asset_exif.assetId', '=', 'asset.id'),
          )
          .as('totalSize'),
        eb.fn.max('asset.fileModifiedAt').as('lastModified'),
      ])
      .where('ownerId', '=', asUuid(userId))
      .where('isVisible', '=', true)
      .where('deletedAt', 'is', null)
      .where('originalPath', 'like', `${pathPrefix}%`);

    const [childrenStats, parentStats] = await Promise.all([childrenQuery.execute(), parentStatsQuery.executeTakeFirst()]);

    const response: FolderStatsResponseDto[] = [];

    if (parentStats && Number(parentStats.assetCount) > 0) {
      response.push({
        path: normalizedPath,
        name: normalizedPath.split('/').pop() || '',
        assetCount: Number(parentStats.assetCount),
        totalSize: Number(parentStats.totalSize) || 0,
        lastModified: parentStats.lastModified || new Date(0),
      });
    }

    for (const child of childrenStats) {
      response.push({
        path: `${pathPrefix}${child.folderName}`,
        name: child.folderName as string,
        assetCount: Number(child.assetCount),
        totalSize: Number(child.totalSize) || 0,
        lastModified: child.lastModified || new Date(0),
      });
    }

    return response;
  }
}
