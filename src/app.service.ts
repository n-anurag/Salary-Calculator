import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  private round(value: number): number {
    return Math.round(value * 10) / 10;
  }

  calculateSalary(input: any) {
    const {
      totalSalary,
      totalDays,
      daysPresent,
      basicPercent,
      allowancePercent,
      contributionType = 'PF',
      lunchPerDay = 0,
      companyWorkingDays = 0,
      petrol = 0,
      dress = 0,
      otherAccessory = 0,
    } = input;

    const basic = totalSalary * (basicPercent / 100);
    const allowance = totalSalary * (allowancePercent / 100);

    const basicEarned = (basic / totalDays) * daysPresent;
    const allowanceEarned = (allowance / totalDays) * daysPresent;

    let employeeContribution: number;
    let employerContribution: number;
    let totalContribution: number;

    if (contributionType === 'SSF') {
      employeeContribution = basicEarned * 0.11;
      employerContribution = basicEarned * 0.20;
      totalContribution = employeeContribution + employerContribution;
    } else {
      employeeContribution = basicEarned * 0.10;
      employerContribution = basicEarned * 0.10;
      totalContribution = employeeContribution + employerContribution;
    }

    const totalSalaryWithContribution = basicEarned + allowanceEarned + employeeContribution;
    const totalB = totalSalaryWithContribution - totalContribution;
    const sst = totalB * 0.01;
    const netSalary = totalB - sst;

    const lunchTotal = companyWorkingDays * lunchPerDay;
    const accessoriesTotal = lunchTotal + petrol + dress + otherAccessory;
    const finalPayable = netSalary + accessoriesTotal;

    return {
      basicEarned: this.round(basicEarned),
      allowanceEarned: this.round(allowanceEarned),
      employeeContribution: this.round(employeeContribution),
      employerContribution: this.round(employerContribution),
      totalContribution: this.round(totalContribution),
      totalSalary: this.round(totalSalaryWithContribution),
      totalB: this.round(totalB),
      sst: this.round(sst),
      netSalary: this.round(netSalary),
      lunchTotal: this.round(lunchTotal),
      accessoriesTotal: this.round(accessoriesTotal),
      finalPayable: this.round(finalPayable),
      contributionType,
    };
  }
}