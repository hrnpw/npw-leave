/**
 * Centralized error message handling
 * Provides consistent, user-friendly error messages across the system
 */

export interface ErrorMessage {
  title: string;
  description: string;
  duration?: number;
}

/**
 * Parse error and return user-friendly message
 */
export function parseError(error: any, context?: string): ErrorMessage {
  const defaultTitle = context || 'เกิดข้อผิดพลาด';
  const defaultDescription = 'กรุณาลองอีกครั้ง หากปัญหายังคงอยู่ติดต่อฝ่ายบุคคล';

  // Network errors
  if (error.message === 'Failed to fetch' || !navigator.onLine) {
    return {
      title: 'ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์',
      description: 'ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองอีกครั้ง',
      duration: 5000,
    };
  }

  // Rate limiting
  if (error.message?.includes('ล็อก') || error.message?.includes('หลายครั้ง')) {
    return {
      title: 'พยายามหลายครั้งเกินไป',
      description: 'กรุณารอ 15 นาทีแล้วลองใหม่',
      duration: 5000,
    };
  }

  // Authentication errors
  if (error.message?.includes('ชื่อผู้ใช้') || error.message?.includes('รหัสผ่าน')) {
    return {
      title: 'ข้อมูลไม่ถูกต้อง',
      description: 'กรุณาตรวจสอบชื่อผู้ใช้และรหัสผ่าน',
      duration: 5000,
    };
  }

  // Account suspended
  if (error.message?.includes('ปิดใช้งาน') || error.message?.includes('ระงับ')) {
    return {
      title: 'บัญชีถูกระงับ',
      description: 'กรุณาติดต่อฝ่ายบุคคลเพื่อขอความช่วยเหลือ',
      duration: 5000,
    };
  }

  // Not found errors
  if (error.message?.includes('ไม่พบ')) {
    return {
      title: 'ไม่พบข้อมูล',
      description: error.message || 'ข้อมูลที่ต้องการอาจถูกลบหรือย้ายไปแล้ว กรุณารีเฟรชหน้า',
      duration: 5000,
    };
  }

  // Default fallback
  return {
    title: defaultTitle,
    description: error.message || defaultDescription,
    duration: 4000,
  };
}

/**
 * Specific error messages for leave submission
 */
export function parseLeaveSubmissionError(error: any): ErrorMessage {
  // Overlap errors
  if (error.message?.includes('ทับซ้อน') || error.message?.includes('overlap')) {
    return {
      title: 'ช่วงวันที่ทับซ้อนกับใบลาเดิม',
      description: error.message || 'กรุณาเลือกช่วงวันที่ไม่ทับซ้อนกับใบลาที่มีอยู่',
      duration: 5000,
    };
  }

  // Backdate errors
  if (error.message?.includes('ย้อนหลัง') || error.message?.includes('backdate')) {
    return {
      title: 'ไม่สามารถยื่นย้อนหลังได้',
      description: 'ท่านสามารถยื่นใบลาย้อนหลังได้ไม่เกิน 14 วัน',
      duration: 5000,
    };
  }

  // Quota warnings
  if (error.message?.includes('โควตา') || error.message?.includes('เกิน') || error.message?.includes('quota')) {
    return {
      title: 'วันลาใกล้ถึงหรือเกินเกณฑ์',
      description: 'ท่านยังสามารถยื่นได้ แต่ควรปรึกษาฝ่ายบุคคล',
      duration: 5000,
    };
  }

  // Teacher inactive
  if (error.message?.includes('ไม่ได้ใช้งาน') || error.message?.includes('inactive')) {
    return {
      title: 'บัญชีถูกปิดใช้งาน',
      description: 'กรุณาติดต่อฝ่ายบุคคลเพื่อขอความช่วยเหลือ',
      duration: 5000,
    };
  }

  return parseError(error, 'ไม่สามารถยื่นใบลาได้');
}

/**
 * Validation error messages
 */
export function getValidationError(field: string, value: any, requirement?: any): ErrorMessage {
  switch (field) {
    case 'citizenId':
      return {
        title: 'กรุณากรอกเลขบัตรประชาชน 13 หลัก',
        description: `ปัจจุบันกรอก ${value?.length || 0} หลัก`,
        duration: 4000,
      };

    case 'birthDate':
      return {
        title: 'กรุณาเลือกวันเดือนปีเกิด',
        description: 'เลือกวัน เดือน และปีเกิดให้ครบถ้วน',
        duration: 4000,
      };

    case 'reason':
      return {
        title: 'เหตุผลการลาสั้นเกินไป',
        description: `กรุณากรอกอย่างน้อย ${requirement || 10} ตัวอักษร (ปัจจุบัน ${value?.trim().length || 0} ตัวอักษร)`,
        duration: 4000,
      };

    case 'contactAddress':
      return {
        title: 'กรุณากรอกที่อยู่ติดต่อระหว่างลา',
        description: 'ระบุที่อยู่ที่สามารถติดต่อท่านได้ระหว่างวันลา',
        duration: 4000,
      };

    case 'customTypeName':
      return {
        title: 'กรุณาระบุประเภทการลา',
        description: 'ท่านเลือก "อื่นๆ" กรุณาระบุชื่อประเภทการลา',
        duration: 4000,
      };

    case 'dateRange':
      return {
        title: 'กรุณาเลือกช่วงวันที่',
        description: 'เลือกวันเริ่มต้นและวันสิ้นสุดการลา',
        duration: 4000,
      };

    case 'username':
      return {
        title: 'กรุณากรอกชื่อผู้ใช้',
        description: 'ชื่อผู้ใช้ต้องมีอย่างน้อย 3 ตัวอักษร',
        duration: 4000,
      };

    case 'password':
      return {
        title: 'กรุณากรอกรหัสผ่าน',
        description: 'รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร',
        duration: 4000,
      };

    default:
      return {
        title: 'กรุณากรอกข้อมูลให้ครบถ้วน',
        description: 'ตรวจสอบว่าได้กรอกข้อมูลทุกช่องที่จำเป็นแล้ว',
        duration: 4000,
      };
  }
}

/**
 * Success message templates
 */
export function getSuccessMessage(action: string, details?: any): ErrorMessage {
  switch (action) {
    case 'leave_submitted':
      return {
        title: 'ยื่นใบลาสำเร็จ ✓',
        description: details?.leaveNo
          ? `บันทึกใบลา ${details.leaveNo} แล้ว — เราจะแจ้งเตือนเมื่อได้รับการอนุมัติ`
          : 'บันทึกใบลาแล้ว — เราจะแจ้งเตือนเมื่อได้รับการอนุมัติ',
        duration: 4000,
      };

    case 'leave_approved':
      return {
        title: 'อนุมัติใบลาสำเร็จ',
        description: details?.teacherName
          ? `อนุมัติใบลา ${details.leaveNo || ''} ของ ${details.teacherName} แล้ว`
          : 'อนุมัติใบลาสำเร็จ',
        duration: 3000,
      };

    case 'leave_rejected':
      return {
        title: 'ไม่อนุมัติใบลาสำเร็จ',
        description: details?.teacherName
          ? `ส่งเหตุผลถึง ${details.teacherName} แล้ว`
          : 'บันทึกการไม่อนุมัติสำเร็จ',
        duration: 3000,
      };

    case 'leave_cancelled':
      return {
        title: 'ยกเลิกใบลาสำเร็จ',
        description: details?.leaveNo ? `ยกเลิกใบลา ${details.leaveNo} เรียบร้อยแล้ว` : 'ยกเลิกใบลาเรียบร้อยแล้ว',
        duration: 3000,
      };

    case 'login':
      return {
        title: 'เข้าสู่ระบบสำเร็จ',
        description: details?.name ? `ยินดีต้อนรับกลับมา คุณ${details.name} 👋` : 'ยินดีต้อนรับกลับมา',
        duration: 2000,
      };

    case 'logout':
      return {
        title: 'ออกจากระบบสำเร็จ',
        description: 'ขอบคุณที่ใช้งาน — พบกันใหม่เร็วๆ นี้',
        duration: 2000,
      };

    case 'saved':
      return {
        title: 'บันทึกข้อมูลสำเร็จ',
        description: details?.message || '',
        duration: 2000,
      };

    case 'deleted':
      return {
        title: 'ลบข้อมูลสำเร็จ',
        description: details?.message || '',
        duration: 2000,
      };

    default:
      return {
        title: 'ดำเนินการสำเร็จ',
        description: details?.message || '',
        duration: 2000,
      };
  }
}
