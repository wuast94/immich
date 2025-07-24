<script lang="ts">
  import Icon from '$lib/components/elements/icon.svelte';
  import type { TreeNode } from '$lib/utils/tree-utils';
  import { FolderSortBy, folderViewSettings, SortOrder, locale } from '$lib/stores/preferences.store';
  import { mdiArrowDown, mdiArrowUp, mdiFolder, mdiFolderOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  // Temporary interface until SDK is regenerated
  interface FolderStatsResponseDto {
    name: string;
    path: string;
    assetCount: number;
    totalSize: number;
    lastModified: Date;
  }

  interface Props {
    items: TreeNode[];
    path: string;
    onClick: (path: string) => void;
  }

  let { items, path, onClick }: Props = $props();

  const allItems = $derived([
    { value: '.', path: path, children: [], isAsset: false, id: path }, // Synthetic item for current folder
    ...items,
  ]);

  let folderStats: FolderStatsResponseDto[] = $state([]);
  let parentStats: FolderStatsResponseDto | null = $state(null);
  let isLoading = $state(false);

  // Temporary API call function
  async function getFolderStats(apiPath: string): Promise<FolderStatsResponseDto[]> {
    const response = await fetch(`/api/view/folder/stats?path=${encodeURIComponent(apiPath)}`);
    if (!response.ok) {
      throw new Error('Failed to fetch folder stats');
    }
    const data = await response.json();
    return data.map((item: any) => ({
      ...item,
      lastModified: new Date(item.lastModified),
    }));
  }

  // Handle column sorting
  function handleSort(sortBy: FolderSortBy) {
    if ($folderViewSettings.sortBy === sortBy) {
      $folderViewSettings.sortOrder = $folderViewSettings.sortOrder === SortOrder.Asc ? SortOrder.Desc : SortOrder.Asc;
    } else {
      $folderViewSettings.sortBy = sortBy;
      $folderViewSettings.sortOrder = sortBy === FolderSortBy.Name ? SortOrder.Asc : SortOrder.Desc;
    }
  }

  function handleKeyDown(event: KeyboardEvent, value: string) {
    if (event.key === 'Enter') {
      onClick(value);
    }
  }

  // Load folder statistics
  async function loadFolderStats() {
    if (!items.length) return;

    isLoading = true;
    try {
      const stats = await getFolderStats(path);
      if (stats.length > 0 && (stats[0].path === path || (path === '' && stats[0].path === ''))) {
        parentStats = stats.shift() ?? null;
      }
      folderStats = stats;
    } catch (error) {
      console.error('Failed to load folder stats:', error);
      folderStats = [];
    } finally {
      isLoading = false;
    }
  }

  $effect(() => {
    if (items.length > 0) {
      loadFolderStats();
    }
  });

  let sortedFolders = $derived.by(() => {
    const combined = items.map((item) => {
      const stats = folderStats.find((stat) => item.path.endsWith(stat.path)) || {
        name: item.value,
        path: item.path,
        assetCount: 0,
        totalSize: 0,
        lastModified: new Date(0),
      };
      return { item, stats: stats as FolderStatsResponseDto };
    });

    const { sortBy, sortOrder } = $folderViewSettings;

    combined.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case FolderSortBy.Name:
          comparison = a.item.value.localeCompare(b.item.value);
          break;
        case FolderSortBy.AssetCount:
          comparison = a.stats.assetCount - b.stats.assetCount;
          break;
        case FolderSortBy.TotalSize:
          comparison = a.stats.totalSize - b.stats.totalSize;
          break;
        case FolderSortBy.LastModified:
          comparison = new Date(a.stats.lastModified).getTime() - new Date(b.stats.lastModified).getTime();
          break;
      }
      return sortOrder === SortOrder.Desc ? -comparison : comparison;
    });

    return combined;
  });

  // Helper function to format file size
  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  // Helper function to format date according to user's locale
  function formatDate(date: Date): string {
    const loc = $locale === 'default' ? undefined : $locale;
    return new Intl.DateTimeFormat(loc, {
      year: '2-digit',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
  }
</script>

{#if items.length > 0}
  <div class="w-full bg-gray-50 dark:bg-immich-dark-gray/50 rounded-2xl border border-gray-100 dark:border-gray-900 grid" style="grid-template-columns: minmax(0, 1fr) auto auto auto;">
    <!-- Table Header -->
    <div class="contents font-medium text-sm text-gray-600 dark:text-gray-400">
      <button class="text-left hover:text-immich-primary dark:hover:text-immich-dark-primary flex items-center gap-1 p-4 border-b border-gray-200 dark:border-gray-700" onclick={() => handleSort(FolderSortBy.Name)}>
        {$t('name')}
        {#if $folderViewSettings.sortBy === FolderSortBy.Name}
          <Icon path={$folderViewSettings.sortOrder === SortOrder.Asc ? mdiArrowUp : mdiArrowDown} size={16} />
        {/if}
      </button>
      <button class="text-right hover:text-immich-primary dark:hover:text-immich-dark-primary flex items-center justify-end gap-1 p-4 border-b border-gray-200 dark:border-gray-700" onclick={() => handleSort(FolderSortBy.AssetCount)}>
        {$t('items')}
        {#if $folderViewSettings.sortBy === FolderSortBy.AssetCount}
          <Icon path={$folderViewSettings.sortOrder === SortOrder.Asc ? mdiArrowUp : mdiArrowDown} size={16} />
        {/if}
      </button>
      <button class="text-right hover:text-immich-primary dark:hover:text-immich-dark-primary flex items-center justify-end gap-1 p-4 border-b border-gray-200 dark:border-gray-700" onclick={() => handleSort(FolderSortBy.TotalSize)}>
        {$t('size')}
        {#if $folderViewSettings.sortBy === FolderSortBy.TotalSize}
          <Icon path={$folderViewSettings.sortOrder === SortOrder.Asc ? mdiArrowUp : mdiArrowDown} size={16} />
        {/if}
      </button>
      <button class="hidden md:flex text-right hover:text-immich-primary dark:hover:text-immich-dark-primary items-center justify-end gap-1 p-4 border-b border-gray-200 dark:border-gray-700" onclick={() => handleSort(FolderSortBy.LastModified)}>
        {$t('modified')}
        {#if $folderViewSettings.sortBy === FolderSortBy.LastModified}
          <Icon path={$folderViewSettings.sortOrder === SortOrder.Asc ? mdiArrowUp : mdiArrowDown} size={16} />
        {/if}
      </button>
    </div>

    <!-- Folder Rows -->
    {#if parentStats}
      <div class="contents group cursor-pointer" role="button" tabindex="0" title=".">
        <!-- Name with icon -->
        <div class="flex items-center gap-3 min-w-0 p-4 border-b border-gray-100 dark:border-gray-800 group-last:border-b-0 group-hover:bg-immich-primary/10 dark:group-hover:bg-immich-primary/40">
          <Icon path={parentStats.assetCount > 0 ? mdiFolder : mdiFolderOutline} class="text-immich-primary dark:text-immich-dark-primary flex-shrink-0" size={20} />
          <span class="text-sm dark:text-gray-200 truncate font-medium">
            .
          </span>
        </div>

        <!-- Asset count -->
        <div class="text-right text-sm text-gray-600 dark:text-gray-400 p-4 border-b border-gray-100 dark:border-gray-800 group-last:border-b-0 group-hover:bg-immich-primary/10 dark:group-hover:bg-immich-primary/40">
          {parentStats.assetCount.toLocaleString()}
        </div>

        <!-- Total size -->
        <div class="text-right text-sm text-gray-600 dark:text-gray-400 p-4 border-b border-gray-100 dark:border-gray-800 group-last:border-b-0 group-hover:bg-immich-primary/10 dark:group-hover:bg-immich-primary/40">
          {formatBytes(parentStats.totalSize)}
        </div>

        <!-- Last modified (hidden on mobile) -->
        <div class="hidden md:block text-right text-sm text-gray-600 dark:text-gray-400 p-4 border-b border-gray-100 dark:border-gray-800 group-last:border-b-0 group-hover:bg-immich-primary/10 dark:group-hover:bg-immich-primary/40">
          {parentStats.lastModified.getTime() > 0 ? formatDate(parentStats.lastModified) : '—'}
        </div>
      </div>
    {/if}
    {#if isLoading}
      <div class="p-8 text-center text-gray-500 dark:text-gray-400 col-span-4">
        {$t('loading')}...
      </div>
    {:else}
      {#each sortedFolders as { item, stats } (item.value)}
        <div class="contents group cursor-pointer" role="button" tabindex="0" title={item.value} onclick={() => onClick(item.value)} onkeydown={(e) => handleKeyDown(e, item.value)}>
            <!-- Name with icon -->
            <div class="flex items-center gap-3 min-w-0 p-4 border-b border-gray-100 dark:border-gray-800 group-last:border-b-0 group-hover:bg-immich-primary/10 dark:group-hover:bg-immich-primary/40">
              <Icon path={stats.assetCount > 0 ? mdiFolder : mdiFolderOutline} class="text-immich-primary dark:text-immich-dark-primary flex-shrink-0" size={20} />
              <span class="text-sm dark:text-gray-200 truncate font-medium">
                {item.value}
              </span>
            </div>

            <!-- Asset count -->
            <div class="text-right text-sm text-gray-600 dark:text-gray-400 p-4 border-b border-gray-100 dark:border-gray-800 group-last:border-b-0 group-hover:bg-immich-primary/10 dark:group-hover:bg-immich-primary/40">
              {stats.assetCount.toLocaleString()}
            </div>

            <!-- Total size -->
            <div class="text-right text-sm text-gray-600 dark:text-gray-400 p-4 border-b border-gray-100 dark:border-gray-800 group-last:border-b-0 group-hover:bg-immich-primary/10 dark:group-hover:bg-immich-primary/40">
              {formatBytes(stats.totalSize)}
            </div>

            <!-- Last modified (hidden on mobile) -->
            <div class="hidden md:block text-right text-sm text-gray-600 dark:text-gray-400 p-4 border-b border-gray-100 dark:border-gray-800 group-last:border-b-0 group-hover:bg-immich-primary/10 dark:group-hover:bg-immich-primary/40">
              {stats.lastModified.getTime() > 0 ? formatDate(stats.lastModified) : '—'}
            </div>
        </div>
      {/each}
    {/if}
  </div>
{/if}