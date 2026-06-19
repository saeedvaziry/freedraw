export type PageVisibility = 'private' | 'organization' | 'public';

export type PagePermission = 'view' | 'edit';

export type BoardPage = {
    publicId: string;
    organizationId: number;
    title: string;
    document: string | null;
    url: string;
    visibility: PageVisibility;
    permission: PagePermission;
    /** Absolute public share URL, present only when the page is public. */
    shareUrl: string | null;
    /** Whether the current viewer may change sharing settings. */
    canShare: boolean;
    /** Whether the current viewer may edit the page document. */
    canEdit: boolean;
    updatedAt: string | null;
};

/** Access context for a board viewed through a public share link. */
export type BoardAccess = {
    isPublic: boolean;
    canEdit: boolean;
};
