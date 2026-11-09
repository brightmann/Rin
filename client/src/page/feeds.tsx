import { useContext, useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../app/runtime"
import { ProfileContext } from "../state/profile"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { useTranslation } from "react-i18next";

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

type FeedType = 'draft' | 'unlisted' | 'normal'

type FeedsMap = {
    [key in FeedType]: FeedsData
}

export function FeedsPage() {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const query = new URLSearchParams(useSearch());
    const profile = useContext(ProfileContext);
    const [listState, _setListState] = useState<FeedType>(query.get("type") as FeedType || 'normal')
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false }
    })
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(siteConfig.pageSize, query.get("limit"))
    const feedListClass = siteConfig.feedLayout === "masonry" ? "wauto columns-1 gap-5 ani-show md:columns-2" : "wauto flex flex-col ani-show";
    const currentFeeds = feeds[listState] ?? { size: 0, data: [], hasNext: false };
    const currentFeedData = Array.isArray(currentFeeds.data) ? currentFeeds.data : [];
    const totalPages = limit > 0 ? Math.ceil(currentFeeds.size / limit) : 1
    const pageList = ((): (number | '…')[] => {
        if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
        const pages = new Set<number>([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1])
        const sorted = [...pages].filter(p => p >= 1 && p <= totalPages).sort((a, b) => a - b)
        const out: (number | '…')[] = []
        for (let i = 0; i < sorted.length; i++) {
            if (i > 0 && sorted[i] - sorted[i - 1] > 1) out.push('…')
            out.push(sorted[i])
        }
        return out
    })()
    const ref = useRef("")
    function fetchFeeds(type: FeedType) {
        client.feed.list({
            page: page,
            limit: limit,
            type: type
        }).then(({ data }) => {
            if (data) {
                setFeeds({
                    ...feeds,
                    [type]: data
                })
                setStatus('idle')
            }
        })
    }
    useEffect(() => {
        const key = `${query.get("page")} ${query.get("type")} ${limit}`
        if (ref.current == key) return
        const type = query.get("type") as FeedType || 'normal'
        if (type !== listState) {
            _setListState(type)
        }
        setStatus('loading')
        fetchFeeds(type)
        ref.current = key
    }, [limit, query.get("page"), query.get("type")])
    return (
        <>
            <Helmet>
                <title>{`${t('article.title')} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('article.title')} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={feeds.draft.size + feeds.normal.size + feeds.unlisted.size > 0 || status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>
                            {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('article.total$count', { count: currentFeeds.size })}
                            </p>
                            {profile?.permission &&
                                <div className="flex flex-row space-x-4">
                                    <Link href={listState === 'draft' ? '/?type=normal' : '/?type=draft'} className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'draft' ? "text-theme" : ""}`}>
                                        {t('draft_bin')}
                                    </Link>
                                    <Link href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'} className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'unlisted' ? "text-theme" : ""}`}>
                                        {t('unlisted')}
                                    </Link>
                                </div>
                            }
                        </div>
                    </div>
                    <Waiting for={status === 'idle'}>
                        <div className={feedListClass}>
                            {currentFeedData.map(({ id, ...feed }: any) => (
                                <FeedCard key={id} id={id} {...feed} />
                            ))}
                        </div>
                        {totalPages > 1 &&
                            <div className="wauto flex flex-row items-center justify-center gap-2 mt-4 ani-show">
                                {page > 1 &&
                                    <Link href={`/?type=${listState}&page=${(page - 1)}`}
                                        className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}>
                                        {t('previous')}
                                    </Link>
                                }
                                {pageList.map((p, i) => p === '…' ? (
                                    <span key={`ellipsis-${i}`} className="text-sm text-neutral-500 px-1">…</span>
                                ) : (
                                    <Link key={p} href={`/?type=${listState}&page=${p}`}
                                        className={p === page
                                            ? `text-sm font-normal rounded-full px-3 py-2 text-white bg-theme`
                                            : `text-sm font-normal rounded-full px-3 py-2 text-neutral-600 dark:text-neutral-300 hover:bg-black/5 dark:hover:bg-white/10`}>
                                        {p}
                                    </Link>
                                ))}
                                {page < totalPages &&
                                    <Link href={`/?type=${listState}&page=${(page + 1)}`}
                                        className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}>
                                        {t('next')}
                                    </Link>
                                }
                            </div>
                        }
                    </Waiting>
                </main>
            </Waiting>
        </>
    )
}
