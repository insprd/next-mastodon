import { Status, StatusImage } from "../../core/entities/Status";
import { Feed } from "../../core/entities/Feed";
import Cookies from "js-cookie";
import { createRestAPIClient, mastodon } from "masto";
import { getSession } from "next-auth/react";

export const transformMastojsStatus = (
  mastoStatus: mastodon.v1.Status,
): Status => {
  let images: StatusImage[] = [];
  if (mastoStatus.mediaAttachments.length > 0) {
    images = mastoStatus.mediaAttachments.map((media) => {
      return {
        previewUrl: media.previewUrl,
        fullUrl: media.url,
        fullWidth: media.meta?.original?.width,
        fullHeight: media.meta?.original?.height,
        hash: media.blurhash,
      };
    });
  }

  const output: Status = {
    id: mastoStatus.id,
    name: mastoStatus.account.displayName,
    avatar: mastoStatus.account.avatar,
    authorUrl: mastoStatus.account.url,
    createdAt: mastoStatus.createdAt,
    text: mastoStatus.content,
    sharesCount: mastoStatus.reblogsCount,
    commentsCount: mastoStatus.repliesCount,
    likesCount: mastoStatus.favouritesCount,
    images: images,
    favourited: mastoStatus.favourited ?? false,
    bookmarked: mastoStatus.bookmarked ?? false,
    shared: mastoStatus.reblogged ?? false,
    reblogged: undefined,
    sensitive: mastoStatus.sensitive ?? false,
  };

  if (mastoStatus.reblog) {
    output.reblogged = transformMastojsStatus(mastoStatus.reblog);
  }

  return output;
};

export const fetchFeedPage = async (
  paginator: mastodon.Paginator<
    mastodon.v1.Status[],
    mastodon.rest.v1.ListTimelineParams
  >,
): Promise<Feed> => {
  const results = await paginator.next();
  return {
    statuses: !results.done ? results.value.map(transformMastojsStatus) : [],
  };
};

export class MastojsClientFactory {
  private static client: mastodon.rest.Client | undefined;

  public static async getClient(): Promise<mastodon.rest.Client> {
    if (this.client) {
      return this.client;
    }

    //TODO: move this to libs to share whenever it is needed
    let activeServer = Cookies.get("activeServer");
    if (activeServer) {
      activeServer = atob(activeServer);
    }

    const sessionData = await getSession();
    const accessToken = sessionData?.access_token || "";

    if (accessToken && activeServer) {
      this.client = createRestAPIClient({
        url: activeServer,
        accessToken: accessToken,
      });
    } else {
      throw new Error(
        "An error with getting the mastodon client. Either the active server or the access token was not found.",
      );
    }

    return this.client;
  }
}
