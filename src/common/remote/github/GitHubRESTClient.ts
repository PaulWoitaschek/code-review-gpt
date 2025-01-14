import { Octokit } from "octokit";

import { isEligibleForReview } from "./isEligibleForReview";
import { PullRequestIdentifier } from "./types";
import { githubToken } from "../../../config";
import { ReviewFile } from "../../types";

type GithubFile = {
  sha: string;
  filename: string;
  status:
    | "added"
    | "removed"
    | "modified"
    | "renamed"
    | "copied"
    | "changed"
    | "unchanged";
  additions: number;
  deletions: number;
  changes: number;
  blob_url: string;
  raw_url: string;
  contents_url: string;
  patch?: string | undefined;
  previous_filename?: string | undefined;
};

export class GitHubRESTClient {
  private client: Octokit = new Octokit({ auth: githubToken() });

  async fetchReviewFiles(
    identifier: PullRequestIdentifier
  ): Promise<ReviewFile[]> {
    const rawFiles = await this.client.paginate(
      this.client.rest.pulls.listFiles,
      {
        owner: identifier.owner,
        repo: identifier.repo,
        pull_number: identifier.prNumber,
      }
    );

    return await this.fetchPullRequestFiles(rawFiles);
  }

  async fetchPullRequestFiles(rawFiles: GithubFile[]): Promise<ReviewFile[]> {
    const reviewFiles: ReviewFile[] = [];

    for (const rawFile of rawFiles) {
      if (!isEligibleForReview(rawFile.filename, rawFile.status)) {
        continue;
      }

      const reviewFile = await this.fetchPullRequestFile(rawFile);
      reviewFiles.push(reviewFile);
    }

    return reviewFiles;
  }

  async fetchPullRequestFile(rawFile: GithubFile): Promise<ReviewFile> {
    const content = await this.fetchPullRequestFileContent(rawFile.raw_url);

    return {
      fileName: rawFile.filename,
      fileContent: content,
      changedLines: rawFile.patch ?? '',
    };
  }

  async fetchPullRequestFileContent(url: string): Promise<string> {
    const response = await this.client.request(`GET ${url}`);

    if('data' in response && typeof response.data === 'string'){
      return response.data;
    } else{
      throw new Error('Error fetching data from octokit')
    }
  }
}
