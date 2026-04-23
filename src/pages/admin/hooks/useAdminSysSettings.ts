import { useState } from 'react';

interface RetentionValues {
  audit: string;
  content: string;
  billing: string;
}

const INITIAL_RETENTION: RetentionValues = { audit: '365일', content: '90일', billing: '5년' };

export function useAdminSysSettings() {
  // Notice modal / form state
  const [noticeModal, setNoticeModal] = useState(false);
  const [newNoticeTitle, setNewNoticeTitle] = useState('');
  const [newNoticeType, setNewNoticeType] = useState('업데이트');

  // System settings
  const [retentionEdit, setRetentionEdit] = useState(false);
  const [retentionValues, setRetentionValues] = useState<RetentionValues>(INITIAL_RETENTION);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maxConcurrent, setMaxConcurrent] = useState('800');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [watermarkDefault, setWatermarkDefault] = useState(true);
  const [autoBlock, setAutoBlock] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);
  const [slackNotif, setSlackNotif] = useState(false);
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [contentAutoFilter, setContentAutoFilter] = useState(true);

  return {
    noticeModal, setNoticeModal,
    newNoticeTitle, setNewNoticeTitle,
    newNoticeType, setNewNoticeType,
    retentionEdit, setRetentionEdit,
    retentionValues, setRetentionValues,
    maintenanceMode, setMaintenanceMode,
    maxConcurrent, setMaxConcurrent,
    sessionTimeout, setSessionTimeout,
    watermarkDefault, setWatermarkDefault,
    autoBlock, setAutoBlock,
    emailNotif, setEmailNotif,
    slackNotif, setSlackNotif,
    slackWebhookUrl, setSlackWebhookUrl,
    contentAutoFilter, setContentAutoFilter,
  };
}
