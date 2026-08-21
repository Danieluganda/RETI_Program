import { consentRecordedAt } from "./dateTime";
import type { ConsentRecord } from "./db";

export type VerificationStatus = "auto_verified" | "auto_blocked";

export type ConsentRiskResult = {
  verificationStatus: VerificationStatus;
  riskScore: number;
  riskFlags: string[];
  verificationCheckedAt: string;
};

const oneHourMs = 60 * 60 * 1000;

function timestamp(value: string) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function recentRecords(records: ConsentRecord[], recordedAt: string) {
  const currentTime = timestamp(recordedAt);
  if (!currentTime) return [];
  return records.filter((record) => {
    const recordTime = timestamp(consentRecordedAt(record));
    return recordTime > 0 && currentTime - recordTime >= 0 && currentTime - recordTime <= oneHourMs;
  });
}

function durationSeconds(record: ConsentRecord) {
  const openedAt = timestamp(record.auditFormOpenedAt);
  const submittedAt = timestamp(record.auditSubmittedAt || record.auditServerReceivedAt || record.createdAt);
  if (!openedAt || !submittedAt || submittedAt < openedAt) return null;
  return Math.round((submittedAt - openedAt) / 1000);
}

function geoClusterKey(record: ConsentRecord) {
  if (record.geoLatitude === null || record.geoLongitude === null) return "";
  return `${record.geoLatitude.toFixed(3)},${record.geoLongitude.toFixed(3)}`;
}

function addFlag(flags: string[], flag: string) {
  if (!flags.includes(flag)) flags.push(flag);
}

export function scoreConsentRisk(record: ConsentRecord, existingRecords: ConsentRecord[]): ConsentRiskResult {
  const riskFlags: string[] = [];
  let riskScore = 0;
  const recordedAt = consentRecordedAt(record);
  const recent = recentRecords(existingRecords, recordedAt);

  if (record.consentFormType === "sample-space") {
    if (record.geoCaptureStatus !== "captured" || record.geoLatitude === null || record.geoLongitude === null) {
      riskScore += 70;
      addFlag(riskFlags, "gps_missing_or_not_captured");
    }

    if (record.geoAccuracy !== null && record.geoAccuracy > 250) {
      riskScore += 60;
      addFlag(riskFlags, "gps_accuracy_over_250m");
    }
  }

  const formDuration = durationSeconds(record);
  if (formDuration !== null && formDuration < 60) {
    riskScore += 60;
    addFlag(riskFlags, "form_completed_under_60_seconds");
  }

  const collectorKey = record.collectorId || record.collectorName;
  if (collectorKey) {
    const collectorCount = recent.filter((item) => (item.collectorId || item.collectorName) === collectorKey).length;
    if (collectorCount >= 10) {
      riskScore += 60;
      addFlag(riskFlags, "collector_10_or_more_submissions_in_1_hour");
    }
  }

  if (record.auditUserAgent) {
    const deviceCount = recent.filter((item) => item.auditUserAgent === record.auditUserAgent).length;
    if (deviceCount >= 15) {
      riskScore += 60;
      addFlag(riskFlags, "same_device_15_or_more_submissions_in_1_hour");
    }
  }

  if (record.auditIpAddress) {
    const ipCount = recent.filter((item) => item.auditIpAddress === record.auditIpAddress).length;
    if (ipCount >= 20) {
      riskScore += 40;
      addFlag(riskFlags, "same_ip_20_or_more_submissions_in_1_hour");
    }
  }

  const currentGeoCluster = geoClusterKey(record);
  if (currentGeoCluster) {
    const geoClusterCount = recent.filter((item) => geoClusterKey(item) === currentGeoCluster).length;
    if (geoClusterCount >= 10) {
      riskScore += 60;
      addFlag(riskFlags, "same_gps_cluster_10_or_more_submissions_in_1_hour");
    }
  }

  return {
    verificationStatus: riskScore >= 60 ? "auto_blocked" : "auto_verified",
    riskScore,
    riskFlags,
    verificationCheckedAt: new Date().toISOString(),
  };
}

export function isAutoVerifiedConsent(record: ConsentRecord) {
  return !record.verificationStatus || record.verificationStatus === "auto_verified";
}
